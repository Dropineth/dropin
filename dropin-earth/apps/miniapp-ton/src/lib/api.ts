import type {
  ApiResponse,
  CampaignDetail,
  CampaignMe,
  LotteryRound,
  LotteryRoundDetail,
  LotteryRoundResults,
  PaymentInstruction,
  PaymentIntent,
  Region,
} from "@dropin/schemas";

export type { ApiResponse } from "@dropin/schemas";

export const apiBaseUrl = process.env.NEXT_PUBLIC_DROPIN_API_URL ?? "http://localhost:8787";

export const miniappRuntimeConfig = {
  apiBaseUrl,
  mode: process.env.NEXT_PUBLIC_CANOPYPROOF_MODE ?? process.env.NEXT_PUBLIC_DROPIN_MODE ?? "testnet",
  enableMainnetPayments: process.env.NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS === "true",
} as const;

export async function getApi<T>(path: string) {
  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }
  return payload.data;
}

export async function postApi<T>(path: string, body: unknown) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }
  return payload.data;
}

export const miniappApi = {
  regions: () => getApi<Region[]>("/regions"),
  rounds: () => getApi<LotteryRound[]>("/lottery/rounds"),
  round: (roundId: string) => getApi<LotteryRoundDetail>(`/lottery/rounds/${roundId}`),
  roundResults: (roundId: string) => getApi<LotteryRoundResults>(`/lottery/rounds/${roundId}/results`),
  campaign: (campaignId: string) => getApi<CampaignDetail>(`/campaigns/${campaignId}`),
  campaignMe: (campaignId: string, userId = "demo-user") => getApi<CampaignMe>(`/campaigns/${campaignId}/me?userId=${encodeURIComponent(userId)}`),
  createPaymentIntent: (body: unknown) => postApi<{ intent: PaymentIntent; idempotent: boolean }>("/payments/intents", body),
  paymentInstructions: (intentId: string) => getApi<PaymentInstruction>(`/payments/intents/${intentId}/instructions`),
  submitPaymentIntent: (intentId: string, body: unknown) => postApi<PaymentIntent>(`/payments/intents/${intentId}/submit`, body),
  verifyPaymentIntent: (intentId: string, body: unknown) => postApi<{ intent: PaymentIntent; verification: unknown }>(`/payments/intents/${intentId}/verify`, body),
  enterRound: (roundId: string, body: unknown) => postApi<unknown>(`/lottery/rounds/${roundId}/enter`, body),
};
