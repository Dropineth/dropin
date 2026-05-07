import type { LeafPointsAccount } from "@dropin/schemas";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  campaignId: string;
  leafPoints: number;
};

export function buildLeaderboard(accounts: LeafPointsAccount[], limit = 25): LeaderboardEntry[] {
  return [...accounts]
    .sort((left, right) => right.balance - left.balance || left.userId.localeCompare(right.userId))
    .slice(0, limit)
    .map((account, index) => ({
      rank: index + 1,
      userId: account.userId,
      campaignId: account.campaignId,
      leafPoints: account.balance,
    }));
}
