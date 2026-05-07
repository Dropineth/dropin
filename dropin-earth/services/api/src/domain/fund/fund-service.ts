import {
  allocationChallengeSchema,
  createFundAllocationSchema,
  releaseMilestoneFundsSchema,
  settleMilestoneSchema,
  type FundAllocation,
  type LotteryRound,
  type TreasuryAccount,
} from "@dropin/schemas";
import type { ImpactRepository } from "../impact/impact-repository.js";
import {
  FundAllocationNotFoundError,
  MilestoneReleaseNotFoundError,
  SettlementCertificateNotFoundError,
  SettlementRequirementError,
  TreasuryTransactionNotFoundError,
} from "./fund-errors.js";
import { computeSettlementCertificateHash, computeSettlementEvidenceRoot, decimalBpsAmount } from "./fund-engine.js";
import type { FundRepository } from "./fund-repository.js";
import { treasuryAccountId } from "./fund-repository.js";
import { assertFundTransition } from "./fund-state-machine.js";
import { assertIssuedCertificate, assertMilestoneReleaseable } from "./milestone-settlement.js";
import { reverseLedgerTransaction } from "./treasury-ledger.js";

export class FundService {
  constructor(
    private readonly repo: FundRepository,
    private readonly impactRepo: ImpactRepository,
  ) {}

  listAllocations() {
    return this.repo.listFundAllocations();
  }

  async getAllocation(allocationId: string) {
    const allocation = await this.repo.getFundAllocation(allocationId);
    if (!allocation) {
      throw new FundAllocationNotFoundError(allocationId);
    }
    return allocation;
  }

  listTreasuryTransactions() {
    return this.repo.listTreasuryTransactions();
  }

  listTreasuryAccounts() {
    return this.repo.listTreasuryAccounts();
  }

  listMilestoneReleases(projectId?: string) {
    return this.repo.listMilestoneReleases(projectId);
  }

  listSettlementCertificates(projectId?: string) {
    return this.repo.listSettlementCertificates(projectId);
  }

  async getMilestoneSettlement(projectId: string, milestoneId: string) {
    const [release, settlement] = await Promise.all([
      this.repo.getLatestMilestoneRelease(projectId, milestoneId),
      this.repo.getLatestSettlement(projectId, milestoneId),
    ]);
    return { release, settlement };
  }

  async createAllocation(input: unknown, actor = "api-admin") {
    const parsed = createFundAllocationSchema.parse(input);
    await this.repo.ensureCoreAccounts(parsed.currency);
    const transaction =
      parsed.ledgerTransactionId === undefined
        ? await this.repo.createTreasuryTransaction({
            id: this.repo.makeId("treasury_tx"),
            type: transactionTypeForSource(parsed.sourceType),
            debitAccountId:
              parsed.sourceType === "lottery_round"
                ? treasuryAccountId("round_escrow", parsed.currency, "global")
                : treasuryAccountId("protocol_reserve", parsed.currency),
            creditAccountId: treasuryAccountId(accountForAllocation(parsed.allocationType), parsed.currency),
            amount: parsed.amount,
            currency: parsed.currency,
            sourceType: parsed.sourceType,
            sourceId: parsed.sourceId,
            status: "posted",
            memo: `${parsed.allocationType} allocation from ${parsed.sourceType}/${parsed.sourceId}`,
          })
        : undefined;
    const allocation = await this.repo.createFundAllocation({
      ...parsed,
      ledgerTransactionId: parsed.ledgerTransactionId ?? transaction?.id,
    });
    await this.repo.createAuditLog({
      actor,
      action: "fund_allocation.create",
      entityType: "fund_allocation",
      entityId: allocation.id,
      afterState: { allocation, transaction },
    });
    return allocation;
  }

  async approveAllocation(allocationId: string, actor = "api-admin") {
    const allocation = await this.getAllocation(allocationId);
    if (!["created", "allocated", "pending_approval", "approved"].includes(allocation.status)) {
      assertFundTransition(allocation.status, "approved");
    }
    const updated = await this.repo.updateFundAllocation({ ...allocation, status: "approved" });
    await this.repo.createAuditLog({
      actor,
      action: "fund_allocation.approve",
      entityType: "fund_allocation",
      entityId: allocationId,
      beforeState: allocation,
      afterState: updated,
    });
    return updated;
  }

  async releaseAllocation(allocationId: string, actor = "api-admin") {
    const allocation = await this.getAllocation(allocationId);
    if (!["approved", "timelocked", "released"].includes(allocation.status)) {
      assertFundTransition(allocation.status, "released");
    }
    const updated = await this.repo.updateFundAllocation({ ...allocation, status: "released" });
    await this.repo.createAuditLog({
      actor,
      action: "fund_allocation.release",
      entityType: "fund_allocation",
      entityId: allocationId,
      beforeState: allocation,
      afterState: updated,
    });
    return updated;
  }

  async challengeAllocation(allocationId: string, input: unknown) {
    const parsed = allocationChallengeSchema.parse(input);
    const before = await this.getAllocation(allocationId);
    const updated = await this.repo.updateFundAllocation({ ...before, status: "challenged" });
    await this.repo.createAuditLog({
      actor: parsed.challenger,
      action: "fund_allocation.challenge",
      entityType: "fund_allocation",
      entityId: allocationId,
      beforeState: before,
      afterState: { ...updated, reason: parsed.reason },
    });
    return updated;
  }

  async allocateLotteryRound(round: LotteryRound, actor = "lottery-engine") {
    const currency = round.ticketPriceSymbol;
    await this.repo.ensureCoreAccounts(currency);
    const allocationSpecs = [
      { allocationType: "tree_fund", bps: round.treeFundBps },
      { allocationType: "prize_pool", bps: round.prizePoolBps },
      { allocationType: "operations", bps: round.operationsBps },
      { allocationType: "insurance_challenge_pool", bps: round.challengePoolBps },
      { allocationType: "referral_growth", bps: round.referralBps },
    ] as const;

    const created: FundAllocation[] = [];
    for (const spec of allocationSpecs) {
      const existing = await this.repo.getFundAllocationBySource("lottery_round", round.id, spec.allocationType);
      if (existing) {
        created.push(existing);
        continue;
      }

      const amount = decimalBpsAmount(round.totalAmount, spec.bps);
      const transaction = await this.repo.createTreasuryTransaction({
        id: this.repo.makeId("treasury_tx"),
        type: "lottery_allocation",
        debitAccountId: treasuryAccountId("round_escrow", currency, "global"),
        creditAccountId: treasuryAccountId(accountForAllocation(spec.allocationType), currency),
        amount,
        currency,
        sourceType: "lottery_round",
        sourceId: round.id,
        status: "posted",
        memo: `${spec.allocationType} allocation for ${round.id}`,
      });
      const allocation = await this.repo.createFundAllocation({
        sourceType: "lottery_round",
        sourceId: round.id,
        allocationType: spec.allocationType,
        amount,
        currency,
        status: "allocated",
        ledgerTransactionId: transaction.id,
      });
      await this.repo.createAuditLog({
        actor,
        action: "fund_allocation.lottery_allocate",
        entityType: "fund_allocation",
        entityId: allocation.id,
        afterState: { allocation, transaction },
      });
      created.push(allocation);
    }
    return created;
  }

  async releaseMilestone(projectId: string, milestoneId: string, input: unknown) {
    const parsed = releaseMilestoneFundsSchema.parse(input);
    const detail = await this.mustGetProject(projectId);
    const milestone = detail.milestones.find((item) => item.id === milestoneId);
    if (!milestone) {
      throw new SettlementRequirementError(`Milestone not found: ${milestoneId}`);
    }
    assertMilestoneReleaseable(milestone);
    await this.repo.ensureCoreAccounts(parsed.currency);
    const escrow = await this.repo.ensureProjectEscrowAccount(projectId, parsed.currency);
    const transaction = await this.repo.createTreasuryTransaction({
      id: this.repo.makeId("treasury_tx"),
      type: "milestone_release",
      debitAccountId: treasuryAccountId("tree_planting_fund", parsed.currency),
      creditAccountId: escrow.id,
      amount: parsed.amount,
      currency: parsed.currency,
      sourceType: "project_milestone",
      sourceId: milestoneId,
      status: "posted",
      memo: `Milestone release for ${projectId}/${milestoneId}`,
    });
    const release = await this.repo.createMilestoneRelease({
      projectId,
      milestoneId,
      allocationId: parsed.allocationId,
      amount: parsed.amount,
      currency: parsed.currency,
      status: "released",
      ledgerTransactionId: transaction.id,
    });
    await this.impactRepo.updateMilestoneStatus(milestoneId, "released");
    if (parsed.allocationId) {
      const allocation = await this.getAllocation(parsed.allocationId);
      await this.repo.updateFundAllocation({ ...allocation, status: "released" });
    }
    await this.repo.createAuditLog({
      actor: parsed.actor,
      action: "project_milestone.release_funds",
      entityType: "project_milestone_release",
      entityId: release.id,
      beforeState: milestone,
      afterState: { release, transaction },
    });
    return { release, transaction };
  }

  async settleMilestone(projectId: string, milestoneId: string, input: unknown) {
    const parsed = settleMilestoneSchema.parse(input);
    const detail = await this.mustGetProject(projectId);
    const release = parsed.releaseId
      ? await this.repo.getMilestoneRelease(parsed.releaseId)
      : await this.repo.getLatestMilestoneRelease(projectId, milestoneId);
    if (!release) {
      throw new MilestoneReleaseNotFoundError(parsed.releaseId ?? `${projectId}/${milestoneId}`);
    }
    const acceptedEvidence = detail.evidence.filter((evidence) => evidence.status === "accepted");
    if (acceptedEvidence.length === 0) {
      throw new SettlementRequirementError("Milestone settlement requires at least one accepted evidence object.");
    }
    const certificate = parsed.certificateId ? await this.impactRepo.getCertificate(parsed.certificateId) : undefined;
    if (parsed.finalSettlement) {
      if (!parsed.certificateId) {
        throw new SettlementRequirementError("Final settlement requires an issued Impact Certificate.");
      }
      assertIssuedCertificate(certificate, parsed.certificateId);
    }

    const evidenceRoot = computeSettlementEvidenceRoot(acceptedEvidence);
    const settlementHash = computeSettlementCertificateHash({
      projectId,
      milestoneId,
      evidenceRoot,
      amount: release.amount,
      currency: release.currency,
      certificateId: parsed.certificateId,
      finalSettlement: parsed.finalSettlement,
    });
    const settlement = await this.repo.createSettlementCertificate({
      projectId,
      milestoneId,
      releaseId: release.id,
      evidenceRoot,
      amount: release.amount,
      currency: release.currency,
      certificateId: parsed.certificateId,
      settlementHash,
      finalSettlement: parsed.finalSettlement,
      status: "issued",
    });
    const settledRelease = await this.repo.updateMilestoneReleaseStatus(release.id, "settled");
    if (release.allocationId) {
      const allocation = await this.getAllocation(release.allocationId);
      const allocationStatus = parsed.finalSettlement ? "settled" : "evidence_accepted";
      await this.repo.updateFundAllocation({ ...allocation, status: allocationStatus });
    }
    await this.repo.createAuditLog({
      actor: parsed.actor,
      action: "project_milestone.settle",
      entityType: "settlement_certificate",
      entityId: settlement.id,
      beforeState: release,
      afterState: { release: settledRelease, settlement },
    });
    return { release: settledRelease, settlement };
  }

  async reverseTransaction(transactionId: string, actor = "api-admin") {
    const transaction = await this.repo.getTreasuryTransaction(transactionId);
    if (!transaction) {
      throw new TreasuryTransactionNotFoundError(transactionId);
    }
    const reversal = reverseLedgerTransaction(transaction, {
      id: this.repo.makeId("treasury_tx"),
      createdAt: this.repo.now(),
      postedAt: this.repo.now(),
    });
    const created = await this.repo.createTreasuryTransaction(reversal);
    await this.repo.createAuditLog({
      actor,
      action: "treasury_transaction.reverse",
      entityType: "treasury_transaction",
      entityId: transactionId,
      beforeState: transaction,
      afterState: created,
    });
    return created;
  }

  async postPaymentConfirmation(input: {
    paymentIntentId: string;
    purpose: "lottery_entry" | "sponsor_allocation" | "manual_admin";
    purposeId: string;
    amount: string;
    currency: LotteryRound["ticketPriceSymbol"];
    actor?: string | undefined;
  }) {
    const existing = (await this.repo.listTreasuryTransactions()).find(
      (transaction) => transaction.sourceType === "payment_intent" && transaction.sourceId === input.paymentIntentId,
    );
    if (existing) {
      return existing;
    }

    await this.repo.ensureCoreAccounts(input.currency);
    const creditAccountId =
      input.purpose === "lottery_entry"
        ? treasuryAccountId("round_escrow", input.currency, "global")
        : treasuryAccountId("protocol_reserve", input.currency);
    const transaction = await this.repo.createTreasuryTransaction({
      id: this.repo.makeId("treasury_tx"),
      type: "payment_confirmation",
      debitAccountId: treasuryAccountId("payment_clearing", input.currency),
      creditAccountId,
      amount: input.amount,
      currency: input.currency,
      sourceType: "payment_intent",
      sourceId: input.paymentIntentId,
      status: "posted",
      memo: `Confirmed ${input.purpose} payment for ${input.purposeId}`,
    });
    await this.repo.createAuditLog({
      actor: input.actor ?? "payment-service",
      action: "treasury.payment_confirmation",
      entityType: "treasury_transaction",
      entityId: transaction.id,
      afterState: transaction,
    });
    return transaction;
  }

  async markAllocationChallenged(allocationId: string) {
    const allocation = await this.getAllocation(allocationId);
    return this.repo.updateFundAllocation({ ...allocation, status: "challenged" });
  }

  async markTreasuryTransactionChallenged(transactionId: string) {
    const transaction = await this.repo.getTreasuryTransaction(transactionId);
    if (!transaction) {
      throw new TreasuryTransactionNotFoundError(transactionId);
    }
    return this.repo.updateTreasuryTransactionStatus(transactionId, "challenged");
  }

  async markSettlementChallenged(settlementId: string) {
    const settlement = await this.repo.getSettlementCertificate(settlementId);
    if (!settlement) {
      throw new SettlementCertificateNotFoundError(settlementId);
    }
    return this.repo.updateSettlementCertificateStatus(settlementId, "challenged");
  }

  private async mustGetProject(projectId: string) {
    const detail = await this.impactRepo.getProjectDetail(projectId);
    if (!detail) {
      throw new SettlementRequirementError(`Project not found: ${projectId}`);
    }
    return detail;
  }
}

export type FundChallengeTargetRepository = Pick<
  FundService,
  "markAllocationChallenged" | "markTreasuryTransactionChallenged" | "markSettlementChallenged"
>;

export type FundAccount = TreasuryAccount;

function accountForAllocation(allocationType: FundAllocation["allocationType"]): TreasuryAccount["type"] {
  if (allocationType === "tree_fund") return "tree_planting_fund";
  if (allocationType === "insurance_challenge_pool") return "insurance_challenge_pool";
  if (allocationType === "referral_growth") return "referral_growth";
  if (allocationType === "protocol_reserve") return "protocol_reserve";
  if (allocationType === "operations") return "operations";
  return "prize_pool";
}

function transactionTypeForSource(sourceType: FundAllocation["sourceType"]) {
  if (sourceType === "lottery_round") return "lottery_allocation";
  if (sourceType === "sponsor_campaign") return "sponsor_allocation";
  return "admin_adjustment";
}
