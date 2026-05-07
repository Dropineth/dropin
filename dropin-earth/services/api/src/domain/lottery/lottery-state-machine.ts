import type { LotteryRoundStatus } from "@dropin/schemas";
import { InvalidLotteryTransitionError } from "./lottery-errors.js";

export const lotteryTransitions: Record<LotteryRoundStatus, readonly LotteryRoundStatus[]> = {
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

export function assertLotteryTransition(from: LotteryRoundStatus, to: LotteryRoundStatus) {
  if (!lotteryTransitions[from].includes(to)) {
    throw new InvalidLotteryTransitionError(from, to);
  }
}
