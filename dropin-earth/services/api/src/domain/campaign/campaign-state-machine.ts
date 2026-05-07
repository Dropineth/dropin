import type { Campaign } from "@dropin/schemas";
import { CampaignStateError } from "./campaign-errors.js";

const transitions: Record<Campaign["status"], Campaign["status"][]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["active", "cancelled"],
  active: ["ended", "cancelled"],
  ended: ["finalized"],
  finalized: [],
  cancelled: [],
};

export function assertCampaignTransition(from: Campaign["status"], to: Campaign["status"]) {
  if (!transitions[from]?.includes(to)) {
    throw new CampaignStateError(`Invalid campaign transition: ${from} -> ${to}`);
  }
}
