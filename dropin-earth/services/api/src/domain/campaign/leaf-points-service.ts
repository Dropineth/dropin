import type { LeafPointsAccount, LeafPointsTransaction } from "@dropin/schemas";
import type { CampaignRepository } from "./campaign-repository.js";

export type AwardLeafPointsInput = {
  campaignId: string;
  userId: string;
  amount: number;
  sourceType: string;
  sourceId: string;
  reason: string;
};

export class LeafPointsService {
  constructor(private readonly repo: CampaignRepository) {}

  async getAccount(campaignId: string, userId: string): Promise<LeafPointsAccount> {
    return this.repo.ensureLeafPointsAccount(campaignId, userId);
  }

  async award(input: AwardLeafPointsInput): Promise<{ account: LeafPointsAccount; transaction: LeafPointsTransaction; idempotent: boolean }> {
    const existing = await this.repo.getLeafPointsTransactionBySource(input.userId, input.sourceType, input.sourceId);
    if (existing) {
      const account = await this.repo.ensureLeafPointsAccount(existing.campaignId, existing.userId);
      return { account, transaction: existing, idempotent: true };
    }

    const account = await this.repo.ensureLeafPointsAccount(input.campaignId, input.userId);
    const transaction = await this.repo.createLeafPointsTransaction({
      accountId: account.id,
      userId: input.userId,
      campaignId: input.campaignId,
      amount: input.amount,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason,
      status: "posted",
    });
    const updatedAccount = await this.repo.updateLeafPointsBalance(account.id, transaction.amount);
    return { account: updatedAccount, transaction, idempotent: false };
  }
}
