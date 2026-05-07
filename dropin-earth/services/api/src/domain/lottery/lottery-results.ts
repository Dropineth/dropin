import type { LotteryRoundDetail } from "./lottery-repository.js";

export function toPublicRoundResult(detail: LotteryRoundDetail) {
  const userDrops = detail.drops.map((drop) => ({
    id: drop.id,
    entryId: drop.entryId,
    userId: drop.userId,
    wallet: drop.wallet,
    canopyAmount: drop.canopyAmount,
    rwaFragmentAmount: drop.rwaFragmentAmount,
    rarity: drop.rarity,
  }));

  return {
    round: detail.round,
    proof: {
      entryMerkleRoot: detail.round.entryMerkleRoot,
      randomnessCertificateId: detail.randomnessCertificate?.id,
      finalSeed: detail.randomnessCertificate?.finalSeed,
      winnerMerkleRoot: detail.randomnessCertificate?.winnerMerkleRoot,
      dropMerkleRoot: detail.randomnessCertificate?.dropMerkleRoot,
      scriptHash: detail.randomnessCertificate?.scriptHash,
    },
    entries: {
      count: detail.entries.length,
      totalAmount: detail.round.totalAmount,
    },
    winners: detail.winners,
    drops: userDrops,
    rwaFragments: detail.rwaFragments.map((fragment) => ({
      id: fragment.id,
      holderUserId: fragment.holderUserId,
      holderWallet: fragment.holderWallet,
      notionalCo2e: fragment.notionalCo2e,
      status: fragment.status,
      type: fragment.type,
      jurisdictionMode: fragment.jurisdictionMode,
      transferability: fragment.transferability,
      disclosure: "RWA Fragment is allocation eligibility / utility only. It is not guaranteed yield.",
    })),
  };
}
