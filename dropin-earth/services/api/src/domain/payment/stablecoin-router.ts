import type { ChainId, Currency } from "@dropin/schemas";

export function expectedPaymentRecipient(input: { chain: ChainId; currency: Currency; purposeId: string }) {
  if (input.chain === "ton" && input.currency === "TON") {
    return process.env.DROPIN_TON_TESTNET_TREASURY_ADDRESS ?? "ton-testnet://dropin-treasury-placeholder";
  }
  if (input.chain === "manual") {
    return `manual://dropin/${input.currency.toLowerCase()}/${input.purposeId}`;
  }
  return `${input.chain}:dropin-${input.currency.toLowerCase()}-devnet-recipient`;
}

export function paymentAdapterName(chain: ChainId) {
  if (chain === "solana") {
    return "solana-devnet";
  }
  if (chain === "manual") {
    return "manual";
  }
  if (chain === "ton") {
    return "ton_testnet";
  }
  return "mock";
}
