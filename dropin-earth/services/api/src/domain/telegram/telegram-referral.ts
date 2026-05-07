import { createHash } from "node:crypto";

export function referralCodeFor(input: { ownerUserId: string; sourceType: string; sourceId: string }) {
  const digest = createHash("sha256")
    .update(`${input.ownerUserId}:${input.sourceType}:${input.sourceId}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `DPN${digest}`;
}

export function climateProofCopy(input: { roundId: string; referralCode: string }) {
  return `I planted a Ticket Seed into Dropin Earth round ${input.roundId}. Co-plant with me: ${input.referralCode}`;
}
