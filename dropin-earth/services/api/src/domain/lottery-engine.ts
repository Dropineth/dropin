import { hashJson, merkleRoot, deterministicRank, deterministicScore, hashHex } from "@dropin/crypto";
import type {
  DropResult,
  LotteryEntry,
  LotteryRound,
  LotteryRoundStatus,
  RandomnessCertificate,
} from "@dropin/schemas";
import {
  createLotteryEntrySchema,
  createLotteryRoundSchema,
  type LotteryRound as LotteryRoundType,
} from "@dropin/schemas";
import { id, InMemoryRepository, nowIso } from "./repository.js";

const FINALIZE_SCRIPT_HASH = hashHex("dropin-tree-lotto-finalize-v1");

const transitions: Record<LotteryRoundStatus, readonly LotteryRoundStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["open", "cancelled"],
  open: ["closed", "cancelled"],
  closed: ["randomness_requested", "challenged", "cancelled"],
  randomness_requested: ["randomness_committed"],
  randomness_committed: ["winners_computed"],
  winners_computed: ["drop_computed"],
  drop_computed: ["prize_distributed"],
  prize_distributed: ["fund_allocated"],
  fund_allocated: ["certificate_generated"],
  certificate_generated: ["finalized"],
  finalized: ["challenged"],
  challenged: ["finalized", "cancelled"],
  cancelled: [],
};

function assertTransition(from: LotteryRoundStatus, to: LotteryRoundStatus) {
  if (!transitions[from].includes(to)) {
    throw new Error(`Invalid lottery round transition: ${from} -> ${to}`);
  }
}

function calculateTotalAmount(entries: readonly LotteryEntry[]) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount), 0).toFixed(6).replace(/\.?0+$/, "");
}

export class LotteryEngine {
  constructor(private readonly repo: InMemoryRepository) {}

  createRound(input: unknown, actor = "admin") {
    const parsed = createLotteryRoundSchema.parse(input);
    const bpsTotal =
      parsed.prizePoolBps +
      parsed.treeFundBps +
      parsed.canopyDropBps +
      parsed.rwaFragmentDropBps +
      parsed.referralBps +
      parsed.operationsBps +
      parsed.challengePoolBps;

    if (bpsTotal !== 10_000) {
      throw new Error(`Lottery allocation must equal 10000 bps. Received ${bpsTotal}.`);
    }

    const createdAt = nowIso();
    const round: LotteryRound = {
      ...parsed,
      id: id("round"),
      status: "draft",
      entryCount: 0,
      totalAmount: "0",
      createdAt,
      updatedAt: createdAt,
    };

    this.repo.rounds.set(round.id, round);
    this.repo.addAuditLog({
      actor,
      action: "lottery.round.create",
      entityType: "lottery_round",
      entityId: round.id,
      afterState: round,
    });

    return round;
  }

  transitionRound(roundId: string, to: LotteryRoundStatus, actor = "admin") {
    const round = this.mustGetRound(roundId);
    assertTransition(round.status, to);
    const before = { ...round };
    const updated: LotteryRound = { ...round, status: to, updatedAt: nowIso() };
    this.repo.rounds.set(roundId, updated);
    this.repo.addAuditLog({
      actor,
      action: `lottery.round.${to}`,
      entityType: "lottery_round",
      entityId: roundId,
      beforeState: before,
      afterState: updated,
    });
    return updated;
  }

  enterRound(roundId: string, input: unknown) {
    const round = this.mustGetRound(roundId);
    if (round.status !== "open") {
      throw new Error(`Round ${round.id} is ${round.status}; entries require open status.`);
    }

    const parsed = createLotteryEntrySchema.parse(input);
    const createdAt = nowIso();
    const entry: LotteryEntry = {
      ...parsed,
      id: id("entry"),
      roundId,
      createdAt,
    };

    this.repo.entries.set(entry.id, entry);
    const entries = this.repo.getEntriesForRound(roundId);
    const updatedRound: LotteryRound = {
      ...round,
      entryCount: entries.length,
      totalAmount: calculateTotalAmount(entries),
      updatedAt: nowIso(),
    };
    this.repo.rounds.set(roundId, updatedRound);

    return entry;
  }

  closeRound(roundId: string, actor = "admin") {
    const round = this.mustGetRound(roundId);
    if (round.status !== "open") {
      throw new Error(`Round ${round.id} must be open before close.`);
    }

    const entries = this.repo.getEntriesForRound(roundId);
    const entryMerkleRoot = merkleRoot(entries.map((entry) => hashJson(entry)));
    const before = { ...round };
    const updated: LotteryRound = {
      ...round,
      status: "closed",
      entryMerkleRoot,
      entryCount: entries.length,
      totalAmount: calculateTotalAmount(entries),
      updatedAt: nowIso(),
    };

    this.repo.rounds.set(roundId, updated);
    this.repo.addAuditLog({
      actor,
      action: "lottery.round.close",
      entityType: "lottery_round",
      entityId: roundId,
      beforeState: before,
      afterState: updated,
    });
    return updated;
  }

  finalizeRound(roundId: string, actor = "admin") {
    const closedRound = this.mustGetRound(roundId);
    if (closedRound.status !== "closed") {
      throw new Error(`Round ${closedRound.id} must be closed before finalization.`);
    }

    const requested = this.transitionRound(roundId, "randomness_requested", actor);
    const entries = this.repo.getEntriesForRound(roundId);
    const entryMerkleRoot = requested.entryMerkleRoot ?? merkleRoot(entries.map((entry) => hashJson(entry)));
    const publicRandomness = hashHex(`drand:${roundId}:${entryMerkleRoot}`);
    const committeeCommitment = hashHex(`committee-commitment:${roundId}`);
    const committeeReveal = hashHex(`committee-reveal:${roundId}:${entryMerkleRoot}`);
    const finalSeed = hashJson({
      roundId,
      entryMerkleRoot,
      publicRandomness,
      committeeReveal,
    });

    const winners = computeWinners(entries, finalSeed);
    const drops = computeDrops(roundId, entries, finalSeed);
    const winnerMerkleRoot = merkleRoot(winners.map((entry) => hashJson({ roundId, entryId: entry.id, wallet: entry.wallet })));
    const dropMerkleRoot = merkleRoot(drops.map((drop) => drop.merkleLeaf));
    const createdAt = nowIso();
    const certificate: RandomnessCertificate = {
      id: id("randcert"),
      roundId,
      entryMerkleRoot,
      publicRandomness,
      committeeCommitment,
      committeeReveal,
      finalSeed,
      algorithm: "sha256",
      winnerMerkleRoot,
      dropMerkleRoot,
      scriptHash: FINALIZE_SCRIPT_HASH,
      signatures: [`sig:${hashHex(finalSeed).slice(0, 32)}`],
      createdAt,
    };

    this.repo.randomnessCertificates.set(certificate.id, certificate);
    for (const drop of drops) {
      this.repo.dropResults.set(drop.id, drop);
    }

    this.transitionRound(roundId, "randomness_committed", actor);
    this.transitionRound(roundId, "winners_computed", actor);
    this.transitionRound(roundId, "drop_computed", actor);
    this.transitionRound(roundId, "prize_distributed", actor);
    this.transitionRound(roundId, "fund_allocated", actor);
    const beforeCertificate = this.mustGetRound(roundId);
    const certified: LotteryRoundType = {
      ...beforeCertificate,
      status: "certificate_generated",
      randomnessCertificateId: certificate.id,
      roundCertificateHash: hashJson(certificate),
      updatedAt: nowIso(),
    };
    this.repo.rounds.set(roundId, certified);
    this.repo.addAuditLog({
      actor,
      action: "lottery.round.certificate_generated",
      entityType: "lottery_round",
      entityId: roundId,
      beforeState: beforeCertificate,
      afterState: certified,
    });
    return {
      round: this.transitionRound(roundId, "finalized", actor),
      certificate,
      winners,
      drops,
    };
  }

  mustGetRound(roundId: string) {
    const round = this.repo.rounds.get(roundId);
    if (!round) {
      throw new Error(`Round not found: ${roundId}`);
    }

    return round;
  }
}

export function computeWinners(entries: readonly LotteryEntry[], seed: string) {
  if (entries.length === 0) {
    return [];
  }

  const winnerCount = Math.max(1, Math.ceil(entries.length * 0.05));
  return deterministicRank(entries, seed, (entry) => `winner:${entry.id}:${entry.wallet}`).slice(0, winnerCount);
}

export function computeDrops(roundId: string, entries: readonly LotteryEntry[], seed: string): DropResult[] {
  return entries.map((entry) => {
    const score = deterministicScore(seed, `drop:${entry.id}:${entry.wallet}`);
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
      roundId,
      entryId: entry.id,
      userId: entry.userId,
      wallet: entry.wallet,
      canopyAmount,
      rwaFragmentAmount,
      rarity,
    });

    return {
      id: id("drop"),
      roundId,
      entryId: entry.id,
      userId: entry.userId,
      wallet: entry.wallet,
      canopyAmount,
      rwaFragmentAmount,
      rarity,
      merkleLeaf,
      createdAt: nowIso(),
    };
  });
}
