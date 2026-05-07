import { hashJson } from "@dropin/crypto";
import { createLotteryEntrySchema, type LotteryRound, type LotteryRoundStatus } from "@dropin/schemas";
import {
  calculateEntryMerkleRoot,
  computeBpsAmount,
  computeDropResults,
  computeDropRoot,
  computeRwaFragments,
  computeWinnerResults,
  computeWinnerRoot,
  createRandomnessCertificate,
  sumEntryAmount,
} from "./lottery-engine.js";
import { LotteryAlreadyFinalizedError, LotteryEntryClosedError, LotteryNotFoundError } from "./lottery-errors.js";
import type { LotteryRepository } from "./lottery-repository.js";
import { assertLotteryTransition } from "./lottery-state-machine.js";
import { toPublicRoundResult } from "./lottery-results.js";

export type LotteryFinalizationSink = {
  allocateLotteryRound(round: LotteryRound, actor?: string): Promise<unknown>;
};

export type LotteryPaymentGuard = {
  assertLotteryPayment(
    round: LotteryRound,
    input: { paymentIntentId?: string | undefined; amount: string; currency: string; wallet: string; userId: string },
  ): Promise<{ txHash: string; paymentIntentId?: string | undefined }>;
};

export type LotteryEntrySink = {
  awardLotteryEntry(input: {
    roundId: string;
    userId: string;
    entryId: string;
    wallet?: string | undefined;
  }): Promise<unknown>;
};

export class LotteryService {
  constructor(
    private readonly repo: LotteryRepository,
    private readonly finalizationSink?: LotteryFinalizationSink,
    private readonly paymentGuard?: LotteryPaymentGuard,
    private readonly entrySink?: LotteryEntrySink,
  ) {}

  listRegions() {
    return this.repo.listRegions();
  }

  listSpecies(regionId?: string) {
    return this.repo.listSpecies(regionId);
  }

  listRounds() {
    return this.repo.listRounds();
  }

  async getRoundDetail(roundId: string) {
    const detail = await this.repo.getRoundDetail(roundId);
    if (!detail) {
      throw new LotteryNotFoundError(roundId);
    }
    return detail;
  }

  async enterRound(roundId: string, input: unknown) {
    const round = await this.mustGetRound(roundId);
    if (round.status !== "open") {
      throw new LotteryEntryClosedError(round.status);
    }

    const parsed = createLotteryEntrySchema.parse(input);
    if (parsed.idempotencyKey) {
      const existing = await this.repo.getEntryByIdempotencyKey(roundId, parsed.idempotencyKey);
      if (existing) {
        const detail = await this.repo.getRoundDetail(roundId);
        const ticket = detail?.tickets.find((item) => item.entryId === existing.id);
        return {
          entry: existing,
          ticket,
          idempotent: true,
        };
      }
    }

    const payment = this.paymentGuard
      ? await this.paymentGuard.assertLotteryPayment(round, parsed)
      : { txHash: parsed.txHash ?? `legacy-mock-${roundId}-${parsed.wallet}`, paymentIntentId: parsed.paymentIntentId };
    const result = await this.repo.createEntryAndTicket({
      ...parsed,
      roundId,
      txHash: payment.txHash,
      paymentIntentId: payment.paymentIntentId,
    });
    const entries = await this.repo.listEntriesForRound(roundId);
    const updatedRound: LotteryRound = {
      ...round,
      entryCount: entries.length,
      totalAmount: sumEntryAmount(entries),
      updatedAt: this.repo.now(),
    };
    await this.repo.updateRound(updatedRound);
    await this.entrySink?.awardLotteryEntry({
      roundId,
      userId: result.entry.userId,
      entryId: result.entry.id,
      wallet: result.entry.wallet,
    });

    return {
      ...result,
      idempotent: false,
    };
  }

  async closeRound(roundId: string, actor = "api-admin") {
    const round = await this.mustGetRound(roundId);
    if (round.status !== "open") {
      throw new LotteryEntryClosedError(round.status);
    }

    const entries = await this.repo.listEntriesForRound(roundId);
    const before = { ...round };
    const updated: LotteryRound = {
      ...round,
      status: "closed",
      entryMerkleRoot: calculateEntryMerkleRoot(entries),
      entryCount: entries.length,
      totalAmount: sumEntryAmount(entries),
      updatedAt: this.repo.now(),
    };

    await this.repo.updateRound(updated);
    await this.repo.createAuditLog({
      actor,
      action: "lottery.round.close",
      entityType: "lottery_round",
      entityId: roundId,
      beforeState: before,
      afterState: updated,
    });
    return updated;
  }

  async finalizeRound(roundId: string, actor = "api-admin") {
    const detail = await this.getRoundDetail(roundId);
    if (detail.round.status === "finalized") {
      return {
        ...toPublicRoundResult(detail),
        idempotent: true,
      };
    }

    if (detail.round.status !== "closed") {
      throw new LotteryAlreadyFinalizedError(roundId);
    }

    const entryMerkleRoot = detail.round.entryMerkleRoot ?? calculateEntryMerkleRoot(detail.entries);
    const totalAmount = sumEntryAmount(detail.entries);
    const initialSeedCertificate = createRandomnessCertificate({
      id: this.repo.makeId("randcert"),
      roundId,
      entryMerkleRoot,
      winnerMerkleRoot: "pending",
      dropMerkleRoot: "pending",
      createdAt: this.repo.now(),
    });
    const prizePoolAmount = computeBpsAmount(totalAmount, detail.round.prizePoolBps);
    const winners = computeWinnerResults({
      roundId,
      entries: detail.entries,
      seed: initialSeedCertificate.finalSeed,
      prizeCurrency: detail.round.ticketPriceSymbol,
      prizePoolAmount,
      makeId: (prefix) => this.repo.makeId(prefix),
      createdAt: this.repo.now(),
    });
    const drops = computeDropResults({
      roundId,
      entries: detail.entries,
      seed: initialSeedCertificate.finalSeed,
      makeId: (prefix) => this.repo.makeId(prefix),
      createdAt: this.repo.now(),
    });
    const winnerMerkleRoot = computeWinnerRoot(winners);
    const dropMerkleRoot = computeDropRoot(drops);
    const certificate = {
      ...initialSeedCertificate,
      winnerMerkleRoot,
      dropMerkleRoot,
    };
    const rwaFragments = computeRwaFragments({
      roundId,
      regionId: detail.round.regionId,
      drops,
      makeId: (prefix) => this.repo.makeId(prefix),
      createdAt: this.repo.now(),
    });
    const finalized: LotteryRound = {
      ...detail.round,
      status: "finalized",
      entryMerkleRoot,
      entryCount: detail.entries.length,
      totalAmount,
      randomnessCertificateId: certificate.id,
      roundCertificateHash: hashJson(certificate),
      updatedAt: this.repo.now(),
    };

    const statusPath: LotteryRoundStatus[] = [
      "randomness_requested",
      "randomness_committed",
      "winners_computed",
      "drop_computed",
      "prize_distributed",
      "fund_allocated",
      "certificate_generated",
      "finalized",
    ];
    let cursor: LotteryRoundStatus = "closed";
    for (const nextStatus of statusPath) {
      assertLotteryTransition(cursor, nextStatus);
      cursor = nextStatus;
    }

    await this.repo.saveFinalization({
      round: finalized,
      certificate,
      winners,
      drops,
      rwaFragments,
    });
    await this.repo.createAuditLog({
      actor,
      action: "lottery.round.finalize",
      entityType: "lottery_round",
      entityId: roundId,
      beforeState: detail.round,
      afterState: finalized,
    });
    await this.finalizationSink?.allocateLotteryRound(finalized, actor);

    const finalizedDetail = await this.getRoundDetail(roundId);
    return {
      ...toPublicRoundResult(finalizedDetail),
      idempotent: false,
    };
  }

  async getResults(roundId: string) {
    return toPublicRoundResult(await this.getRoundDetail(roundId));
  }

  async listTicketsForUser(userId: string) {
    return this.repo.listTicketsForUser(userId);
  }

  async listDropsForUser(userId: string) {
    return this.repo.listDropsForUser(userId);
  }

  async listRwaFragmentsForUser(userId: string) {
    return this.repo.listRwaFragmentsForUser(userId);
  }

  private async mustGetRound(roundId: string) {
    const round = await this.repo.getRound(roundId);
    if (!round) {
      throw new LotteryNotFoundError(roundId);
    }
    return round;
  }
}
