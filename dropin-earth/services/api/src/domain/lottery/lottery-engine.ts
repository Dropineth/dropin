import { deterministicRank, deterministicScore, hashHex, hashJson, merkleRoot } from "@dropin/crypto";
import type {
  Currency,
  DropResult,
  LotteryEntry,
  LotteryTicket,
  RandomnessCertificate,
  RwaFragment,
  WinnerResult,
} from "@dropin/schemas";

export const FINALIZE_SCRIPT_HASH = hashHex("dropin-tree-lotto-finalize-v2");

export function calculateEntryMerkleRoot(entries: readonly LotteryEntry[]) {
  return merkleRoot(entries.map((entry) => hashJson(stableEntrySnapshot(entry))));
}

export function stableEntrySnapshot(entry: LotteryEntry) {
  return {
    id: entry.id,
    roundId: entry.roundId,
    userId: entry.userId,
    wallet: entry.wallet,
    amount: entry.amount,
    currency: entry.currency,
    regionId: entry.regionId,
    txHash: entry.txHash,
    antiSybilScore: entry.antiSybilScore,
    createdAt: entry.createdAt,
  };
}

export function createRandomnessCertificate(input: {
  id: string;
  roundId: string;
  entryMerkleRoot: string;
  winnerMerkleRoot: string;
  dropMerkleRoot: string;
  createdAt: string;
}) {
  const publicRandomness = hashHex(`drand:${input.roundId}:${input.entryMerkleRoot}`);
  const committeeCommitment = hashHex(`committee-commitment:${input.roundId}`);
  const committeeReveal = hashHex(`committee-reveal:${input.roundId}:${input.entryMerkleRoot}`);
  const finalSeed = hashJson({
    roundId: input.roundId,
    entryMerkleRoot: input.entryMerkleRoot,
    publicRandomness,
    committeeReveal,
  });

  return {
    id: input.id,
    roundId: input.roundId,
    entryMerkleRoot: input.entryMerkleRoot,
    publicRandomness,
    committeeCommitment,
    committeeReveal,
    finalSeed,
    algorithm: "sha256",
    winnerMerkleRoot: input.winnerMerkleRoot,
    dropMerkleRoot: input.dropMerkleRoot,
    scriptHash: FINALIZE_SCRIPT_HASH,
    signatures: [`sig:${hashHex(finalSeed).slice(0, 32)}`],
    createdAt: input.createdAt,
  } satisfies RandomnessCertificate;
}

export function computeWinnerResults(input: {
  roundId: string;
  entries: readonly LotteryEntry[];
  seed: string;
  prizeCurrency: Currency;
  prizePoolAmount: string;
  makeId: (prefix: string) => string;
  createdAt: string;
}) {
  if (input.entries.length === 0) {
    return [];
  }

  const winnerCount = Math.max(1, Math.ceil(input.entries.length * 0.05));
  const ranked = deterministicRank(input.entries, input.seed, (entry) => `winner:${entry.id}:${entry.wallet}`).slice(
    0,
    winnerCount,
  );
  const prizePerWinner = (Number(input.prizePoolAmount) / winnerCount).toFixed(6).replace(/\.?0+$/, "");

  return ranked.map((entry, index) => {
    const merkleLeaf = hashJson({
      roundId: input.roundId,
      entryId: entry.id,
      userId: entry.userId,
      wallet: entry.wallet,
      rank: index + 1,
      prizeAmount: prizePerWinner,
      prizeCurrency: input.prizeCurrency,
    });

    return {
      id: input.makeId("winner"),
      roundId: input.roundId,
      entryId: entry.id,
      userId: entry.userId,
      wallet: entry.wallet,
      rank: index + 1,
      prizeAmount: prizePerWinner,
      prizeCurrency: input.prizeCurrency,
      merkleLeaf,
      createdAt: input.createdAt,
    } satisfies WinnerResult;
  });
}

export function computeDropResults(input: {
  roundId: string;
  entries: readonly LotteryEntry[];
  seed: string;
  makeId: (prefix: string) => string;
  createdAt: string;
}) {
  return input.entries.map((entry) => {
    const score = deterministicScore(input.seed, `drop:${entry.id}:${entry.wallet}`);
    const rarity =
      score >= 99.5 ? "legendary" : score >= 96 ? "epic" : score >= 88 ? "rare" : score >= 45 ? "common" : "none";
    const canopyAmount = {
      none: "0",
      common: "10",
      rare: "120",
      epic: "800",
      legendary: "5000",
    }[rarity];
    const rwaFragmentAmount = {
      none: "0",
      common: "0",
      rare: "0.003",
      epic: "0.018",
      legendary: "0.12",
    }[rarity];
    const merkleLeaf = hashJson({
      roundId: input.roundId,
      entryId: entry.id,
      userId: entry.userId,
      wallet: entry.wallet,
      canopyAmount,
      rwaFragmentAmount,
      rarity,
    });

    return {
      id: input.makeId("drop"),
      roundId: input.roundId,
      entryId: entry.id,
      userId: entry.userId,
      wallet: entry.wallet,
      canopyAmount,
      rwaFragmentAmount,
      rarity,
      merkleLeaf,
      createdAt: input.createdAt,
    } satisfies DropResult;
  });
}

export function computeRwaFragments(input: {
  roundId: string;
  regionId: string;
  drops: readonly DropResult[];
  makeId: (prefix: string) => string;
  createdAt: string;
}) {
  return input.drops
    .filter((drop) => Number(drop.rwaFragmentAmount) > 0)
    .map((drop) => {
      const fragment: RwaFragment = {
        id: input.makeId("rwafrag"),
        holderUserId: drop.userId,
        holderWallet: drop.wallet,
        roundId: input.roundId,
        regionId: input.regionId,
        type: "allocation",
        status: "dropped",
        notionalCo2e: drop.rwaFragmentAmount,
        jurisdictionMode: "global_utility",
        transferability: "restricted",
        evidenceRoot: drop.merkleLeaf,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };

      return {
        ...fragment,
        sourceDropResultId: drop.id,
        rarity: drop.rarity,
      };
    });
}

export function computeTicket(input: {
  roundId: string;
  entry: LotteryEntry;
  ticketNumber: number;
  makeId: (prefix: string) => string;
  createdAt: string;
}) {
  const receiptHash = hashJson({
    roundId: input.roundId,
    entryId: input.entry.id,
    wallet: input.entry.wallet,
    ticketNumber: input.ticketNumber,
  });

  return {
    id: input.makeId("ticket"),
    roundId: input.roundId,
    entryId: input.entry.id,
    userId: input.entry.userId,
    wallet: input.entry.wallet,
    ticketNumber: input.ticketNumber,
    receiptHash,
    status: "issued",
    createdAt: input.createdAt,
  } satisfies LotteryTicket;
}

export function sumEntryAmount(entries: readonly LotteryEntry[]) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount), 0).toFixed(6).replace(/\.?0+$/, "");
}

export function computeBpsAmount(total: string, bps: number) {
  return ((Number(total) * bps) / 10_000).toFixed(6).replace(/\.?0+$/, "");
}

export function computeWinnerRoot(winners: readonly WinnerResult[]) {
  return merkleRoot(winners.map((winner) => winner.merkleLeaf));
}

export function computeDropRoot(drops: readonly DropResult[]) {
  return merkleRoot(drops.map((drop) => drop.merkleLeaf));
}
