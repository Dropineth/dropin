import {
  challengeEvidenceSubmitSchema,
  challengeResolutionInputSchema,
  createChallengeSchema,
  dropClaimSchema,
  resolveRiskEventSchema,
  riskScoreInputSchema,
  type ChallengeCase,
  type ChallengeEvidence,
  type ChallengeResolution,
  type DropClaimResult,
  type RiskEvent,
  type RiskScoreInput,
  type RiskScoreResult,
  type RiskScoreSnapshot,
} from "@dropin/schemas";
import type { ImpactRepository } from "../impact/impact-repository.js";
import type { LotteryRepository } from "../lottery/lottery-repository.js";
import type { FundChallengeTargetRepository } from "../fund/fund-service.js";
import type { PaymentChallengeTargetRepository } from "../payment/payment-service.js";
import { gateDropClaim } from "./drop-gating.js";
import { ChallengeNotFoundError, DropNotFoundError, RiskEventNotFoundError, RwaFragmentNotFoundError } from "./risk-errors.js";
import type { RiskRepository } from "./risk-repository.js";
import { computeAntiSybilScore } from "./sybil-score.js";

export type ScoreWithSnapshot = RiskScoreResult & {
  snapshot: RiskScoreSnapshot;
};

export type ChallengeDetail = {
  challenge: ChallengeCase;
  evidence: ChallengeEvidence[];
  resolutions: ChallengeResolution[];
};

export type ClaimDecision = DropClaimResult & {
  reason: string;
};

export class RiskService {
  constructor(
    private readonly repo: RiskRepository,
    private readonly impactRepo: ImpactRepository,
    private readonly lotteryRepo: LotteryRepository,
    private readonly fundRepo?: FundChallengeTargetRepository,
    private readonly paymentRepo?: PaymentChallengeTargetRepository,
  ) {}

  async score(input: unknown, subjectType = "wallet", subjectId?: string): Promise<ScoreWithSnapshot> {
    const parsed = riskScoreInputSchema.parse(input);
    return this.scoreParsed(parsed, subjectType, subjectId ?? parsed.wallet);
  }

  listRiskEvents() {
    return this.repo.listRiskEvents();
  }

  async getRiskEvent(riskEventId: string) {
    const event = await this.repo.getRiskEvent(riskEventId);
    if (!event) {
      throw new RiskEventNotFoundError(riskEventId);
    }
    return event;
  }

  async resolveRiskEvent(riskEventId: string, input: unknown) {
    const before = await this.getRiskEvent(riskEventId);
    const parsed = resolveRiskEventSchema.parse(input);
    const resolved = await this.repo.resolveRiskEvent(riskEventId, {
      status: parsed.status,
      resolution: parsed.resolution,
    });
    await this.repo.createAuditLog({
      actor: parsed.resolver,
      action: "risk_event.resolve",
      entityType: "risk_event",
      entityId: riskEventId,
      beforeState: before,
      afterState: resolved,
    });
    return resolved;
  }

  async createChallenge(input: unknown) {
    const parsed = createChallengeSchema.parse(input);
    const challenge = await this.repo.createChallenge({
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      challenger: parsed.challenger,
      severity: parsed.severity,
      title: parsed.title,
      attackScenario: parsed.attackScenario,
      evidenceHash: parsed.evidenceHash,
      bondAmount: parsed.bondAmount,
      bondCurrency: parsed.bondCurrency,
      status: "bonded",
      result: "pending",
      rewardAmount: "0",
    });
    const bond = await this.repo.createChallengeBond({
      challengeId: challenge.id,
      challengerUserId: parsed.challenger,
      amount: parsed.bondAmount,
      currency: parsed.bondCurrency ?? "USDC",
      status: "locked",
    });
    await this.repo.createAuditLog({
      actor: parsed.challenger,
      action: "challenge.create",
      entityType: "challenge_case",
      entityId: challenge.id,
      afterState: { challenge, bond },
    });
    return { challenge, bond };
  }

  async listChallenges() {
    return this.repo.listChallenges();
  }

  async getChallengeDetail(challengeId: string): Promise<ChallengeDetail> {
    const challenge = await this.mustGetChallenge(challengeId);
    const [evidence, resolutions] = await Promise.all([
      this.repo.listChallengeEvidence(challengeId),
      this.repo.listChallengeResolutions(challengeId),
    ]);
    return { challenge, evidence, resolutions };
  }

  async addChallengeEvidence(challengeId: string, input: unknown) {
    const challenge = await this.mustGetChallenge(challengeId);
    const parsed = challengeEvidenceSubmitSchema.parse(input);
    const evidence = await this.repo.createChallengeEvidence({
      challengeId,
      uri: parsed.uri,
      evidenceHash: parsed.evidenceHash,
      submittedBy: parsed.submittedBy,
    });
    const updated = await this.repo.updateChallenge({
      ...challenge,
      status: "evidence_submitted",
    });
    await this.repo.createAuditLog({
      actor: parsed.submittedBy,
      action: "challenge.evidence_submit",
      entityType: "challenge_case",
      entityId: challengeId,
      beforeState: challenge,
      afterState: { challenge: updated, evidence },
    });
    return evidence;
  }

  async acceptChallenge(challengeId: string, input: unknown) {
    const challenge = await this.mustGetChallenge(challengeId);
    const parsed = challengeResolutionInputSchema.parse(input);
    const targetBefore = await this.readTarget(challenge);
    const targetAfter = await this.markTargetChallenged(challenge);
    const updated = await this.repo.updateChallenge({
      ...challenge,
      status: "accepted",
      result: "accepted",
      protocolFix: parsed.protocolFix,
    });
    const resolution = await this.repo.createChallengeResolution({
      challengeId,
      resolver: parsed.resolver,
      action: "accept",
      outcome: "accepted",
      notes: parsed.notes,
    });
    await this.repo.createAuditLog({
      actor: parsed.resolver,
      action: "challenge.accept",
      entityType: "challenge_case",
      entityId: challengeId,
      beforeState: { challenge, target: targetBefore },
      afterState: { challenge: updated, target: targetAfter, resolution },
    });
    return { challenge: updated, resolution, target: targetAfter };
  }

  async rejectChallenge(challengeId: string, input: unknown) {
    const challenge = await this.mustGetChallenge(challengeId);
    const parsed = challengeResolutionInputSchema.parse(input);
    const target = await this.readTarget(challenge);
    const updated = await this.repo.updateChallenge({
      ...challenge,
      status: "rejected",
      result: "rejected",
      protocolFix: parsed.protocolFix,
    });
    const resolution = await this.repo.createChallengeResolution({
      challengeId,
      resolver: parsed.resolver,
      action: "reject",
      outcome: "rejected",
      notes: parsed.notes,
    });
    await this.repo.createAuditLog({
      actor: parsed.resolver,
      action: "challenge.reject",
      entityType: "challenge_case",
      entityId: challengeId,
      beforeState: { challenge, target },
      afterState: { challenge: updated, target, resolution },
    });
    return { challenge: updated, resolution, target };
  }

  async resolveChallenge(challengeId: string, input: unknown) {
    const challenge = await this.mustGetChallenge(challengeId);
    const parsed = challengeResolutionInputSchema.parse(input);
    const updated = await this.repo.updateChallenge({
      ...challenge,
      status: "resolved",
      result: "resolved",
      protocolFix: parsed.protocolFix ?? challenge.protocolFix,
    });
    const resolution = await this.repo.createChallengeResolution({
      challengeId,
      resolver: parsed.resolver,
      action: "resolve",
      outcome: "resolved",
      notes: parsed.notes,
    });
    await this.repo.createAuditLog({
      actor: parsed.resolver,
      action: "challenge.resolve",
      entityType: "challenge_case",
      entityId: challengeId,
      beforeState: challenge,
      afterState: { challenge: updated, resolution },
    });
    return { challenge: updated, resolution };
  }

  async claimDrop(dropId: string, input: unknown): Promise<ClaimDecision> {
    const drop = await this.lotteryRepo.getDrop(dropId);
    if (!drop) {
      throw new DropNotFoundError(dropId);
    }
    const parsed = dropClaimSchema.parse(input);
    const risk = await this.scoreParsed(
      {
        wallet: parsed.wallet,
        userId: parsed.userId ?? drop.userId,
        roundId: drop.roundId,
        entryCount: 1,
        totalContributionAmount: "1",
        walletAgeDays: parsed.walletAgeDays,
        priorClaimCount: parsed.priorClaimCount,
        rejectedChallengeCount: parsed.rejectedChallengeCount,
        acceptedEvidenceCount: parsed.acceptedEvidenceCount,
      },
      "drop_result",
      dropId,
    );
    const decision = gateDropClaim({
      kind: "drop_result",
      rarity: drop.rarity,
      score: risk.score,
      riskLevel: risk.riskLevel,
    });
    await this.createRiskEventForGate("drop_result", dropId, risk, decision.reason, decision.outcome);
    return {
      outcome: decision.outcome,
      risk,
      targetType: "drop_result",
      targetId: dropId,
      reason: decision.reason,
    };
  }

  async claimRwaFragment(fragmentId: string, input: unknown): Promise<ClaimDecision> {
    const fragment = await this.lotteryRepo.getRwaFragment(fragmentId);
    if (!fragment) {
      throw new RwaFragmentNotFoundError(fragmentId);
    }
    const parsed = dropClaimSchema.parse(input);
    const risk = await this.scoreParsed(
      {
        wallet: parsed.wallet,
        userId: parsed.userId ?? fragment.holderUserId,
        roundId: fragment.roundId,
        entryCount: 1,
        totalContributionAmount: "1",
        walletAgeDays: parsed.walletAgeDays,
        priorClaimCount: parsed.priorClaimCount,
        rejectedChallengeCount: parsed.rejectedChallengeCount,
        acceptedEvidenceCount: parsed.acceptedEvidenceCount,
      },
      "rwa_fragment",
      fragmentId,
    );
    const decision = gateDropClaim({
      kind: "rwa_fragment",
      fragmentType: fragment.type,
      score: risk.score,
      riskLevel: risk.riskLevel,
      ...(fragment.rarity ? { rarity: fragment.rarity } : {}),
    });
    await this.createRiskEventForGate("rwa_fragment", fragmentId, risk, decision.reason, decision.outcome);
    return {
      outcome: decision.outcome,
      risk,
      targetType: "rwa_fragment",
      targetId: fragmentId,
      reason: decision.reason,
    };
  }

  private async scoreParsed(input: RiskScoreInput, subjectType: string, subjectId: string): Promise<ScoreWithSnapshot> {
    const risk = computeAntiSybilScore(input);
    const snapshot = await this.repo.createRiskScoreSnapshot({
      subjectType,
      subjectId,
      wallet: input.wallet,
      userId: input.userId,
      input,
      ...risk,
    });
    return {
      ...risk,
      snapshot,
    };
  }

  private async createRiskEventForGate(
    subjectType: string,
    subjectId: string,
    risk: RiskScoreResult,
    reason: string,
    outcome: DropClaimResult["outcome"],
  ): Promise<RiskEvent | undefined> {
    if (outcome === "claimable") {
      return undefined;
    }
    return this.repo.createRiskEvent({
      subjectType,
      subjectId,
      riskLevel: risk.riskLevel,
      score: risk.score,
      recommendedAction: risk.recommendedAction,
      reasonCodes: [...risk.reasons, reason],
      status: "open",
    });
  }

  private async mustGetChallenge(challengeId: string) {
    const challenge = await this.repo.getChallenge(challengeId);
    if (!challenge) {
      throw new ChallengeNotFoundError(challengeId);
    }
    return challenge;
  }

  private async readTarget(challenge: ChallengeCase) {
    if (challenge.targetType === "impact_certificate") {
      return this.impactRepo.getCertificate(challenge.targetId);
    }
    if (challenge.targetType === "evidence_object") {
      return this.impactRepo.getEvidence(challenge.targetId);
    }
    if (challenge.targetType === "project") {
      return this.impactRepo.getProject(challenge.targetId);
    }
    if (challenge.targetType === "lottery_round") {
      return this.lotteryRepo.getRound(challenge.targetId);
    }
    if (challenge.targetType === "rwa_fragment") {
      return this.lotteryRepo.getRwaFragment(challenge.targetId);
    }
    if (challenge.targetType === "drop_result") {
      return this.lotteryRepo.getDrop(challenge.targetId);
    }
    if (challenge.targetType === "payment_intent") {
      return this.paymentRepo?.getIntent(challenge.targetId);
    }
    if (
      challenge.targetType === "fund_allocation" ||
      challenge.targetType === "treasury_transaction" ||
      challenge.targetType === "settlement_certificate"
    ) {
      return {
        targetType: challenge.targetType,
        targetId: challenge.targetId,
        fundMutationAvailable: Boolean(this.fundRepo),
      };
    }
    if (challenge.targetType === "round_anchor" || challenge.targetType === "impact_anchor") {
      return {
        targetType: challenge.targetType,
        targetId: challenge.targetId,
        solanaRevokeTodo: true,
      };
    }
    return {
      targetType: challenge.targetType,
      targetId: challenge.targetId,
      statusMutation: "not_supported_in_v1",
    };
  }

  private async markTargetChallenged(challenge: ChallengeCase) {
    if (challenge.targetType === "impact_certificate") {
      return this.impactRepo.updateCertificateStatus(challenge.targetId, "challenged");
    }
    if (challenge.targetType === "evidence_object") {
      return this.impactRepo.updateEvidenceStatus(challenge.targetId, "challenged");
    }
    if (challenge.targetType === "project") {
      const project = await this.impactRepo.getProject(challenge.targetId);
      if (!project) {
        return undefined;
      }
      return this.impactRepo.updateProject({ ...project, status: "challenged" });
    }
    if (challenge.targetType === "lottery_round") {
      return this.lotteryRepo.updateRoundStatus(challenge.targetId, "challenged");
    }
    if (challenge.targetType === "rwa_fragment") {
      return this.lotteryRepo.updateRwaFragmentStatus(challenge.targetId, "challenged");
    }
    if (challenge.targetType === "fund_allocation") {
      return this.fundRepo?.markAllocationChallenged(challenge.targetId);
    }
    if (challenge.targetType === "treasury_transaction") {
      return this.fundRepo?.markTreasuryTransactionChallenged(challenge.targetId);
    }
    if (challenge.targetType === "settlement_certificate") {
      return this.fundRepo?.markSettlementChallenged(challenge.targetId);
    }
    if (challenge.targetType === "payment_intent") {
      return this.paymentRepo?.markPaymentIntentChallenged(challenge.targetId);
    }
    if (challenge.targetType === "round_anchor" || challenge.targetType === "impact_anchor") {
      return {
        targetType: challenge.targetType,
        targetId: challenge.targetId,
        solanaRevokeTodo: "Call revoke_round_anchor or revoke_impact_certificate_anchor after signer wiring.",
      };
    }
    return this.readTarget(challenge);
  }
}
