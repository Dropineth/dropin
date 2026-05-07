"use client";

import { useMemo, useState } from "react";
import { StatusBadge, WalletConnectCard } from "@dropin/ui";
import { apiBaseUrl, type ApiResponse } from "@/lib/api";

type TicketSeed = {
  entry: {
    id: string;
    wallet: string;
    amount: string;
    currency: string;
  };
  ticket?: {
    id: string;
    ticketNumber: number;
    receiptHash: string;
  };
  idempotent: boolean;
};

type PaymentIntent = {
  id: string;
  status: string;
  wallet: string;
  amount: string;
  currency: string;
  chain: string;
  purpose: string;
  purposeId: string;
  expectedRecipient: string;
  submittedTxHash?: string;
  confirmedTxHash?: string;
};

export function LotteryEntryPanel({ roundId, regionId }: { roundId: string; regionId: string }) {
  const [wallet, setWallet] = useState("solana_demo_wallet_7xDropinEarthV1");
  const [amount, setAmount] = useState("1");
  const [currency, setCurrency] = useState("USDC");
  const [txHash, setTxHash] = useState(`mock_tx_${roundId}`);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | undefined>();
  const [ticketSeed, setTicketSeed] = useState<TicketSeed | undefined>();
  const idempotencyKey = useMemo(() => `web-${roundId}-${Date.now()}`, [roundId]);
  const paymentIdempotencyKey = useMemo(() => `payment-${roundId}-${Date.now()}`, [roundId]);

  async function createPaymentIntent() {
    setState("pending");
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/payments/intents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "demo-user",
          wallet,
          purpose: "lottery_entry",
          purposeId: roundId,
          chain: "manual",
          amount,
          currency,
          idempotencyKey: paymentIdempotencyKey,
          metadata: { source: "web_lottery_panel", phase: "phase_8_mock_intent" },
        }),
      });
      const payload = (await response.json()) as ApiResponse<{ intent: PaymentIntent; idempotent: boolean }>;
      if (!payload.ok) {
        throw new Error(payload.error);
      }
      setPaymentIntent(payload.data.intent);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Payment intent creation failed");
    }
  }

  async function submitPayment() {
    if (!paymentIntent) return;
    setState("pending");
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/payments/intents/${paymentIntent.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, observedAmount: amount, observedCurrency: currency, submittedBy: "demo-user" }),
      });
      const payload = (await response.json()) as ApiResponse<PaymentIntent>;
      if (!payload.ok) throw new Error(payload.error);
      setPaymentIntent(payload.data);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Payment submission failed");
    }
  }

  async function simulateConfirmation() {
    if (!paymentIntent) return;
    setState("pending");
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/payments/${paymentIntent.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "web-mock-admin", confirmedTxHash: txHash, observedAmount: amount, observedCurrency: currency }),
      });
      const payload = (await response.json()) as ApiResponse<PaymentIntent>;
      if (!payload.ok) throw new Error(payload.error);
      setPaymentIntent(payload.data);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Payment confirmation failed");
    }
  }

  async function plantAndEnter() {
    setState("pending");
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/lottery/rounds/${roundId}/enter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "demo-user",
          wallet,
          amount,
          currency,
          regionId,
          paymentIntentId: paymentIntent?.id,
          antiSybilScore: 72,
          idempotencyKey,
        }),
      });
      const payload = (await response.json()) as ApiResponse<TicketSeed>;
      if (!payload.ok) {
        throw new Error(payload.error);
      }
      setTicketSeed(payload.data);
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Plant & Enter failed");
    }
  }

  const confirmed = paymentIntent?.status === "confirmed" || paymentIntent?.status === "reconciled";

  const walletStatus =
    state === "error" ? "error" : paymentIntent ? "connected" : state === "pending" ? "connecting" : "disconnected";

  return (
    <WalletConnectCard status={walletStatus} wallet={paymentIntent ? wallet : undefined}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Plant & Enter
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Create a Ticket Seed</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Connect through a mock/testnet Payment Intent first. Dropin never collects private keys.
          </p>
        </div>
        <StatusBadge status={confirmed ? "confirmed" : paymentIntent?.status ?? "pending"}>
          {confirmed ? "confirmed" : paymentIntent?.status ?? "pending"}
        </StatusBadge>
      </div>
      <div className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Wallet mock / testnet wallet</span>
          <input
            className="rounded-[18px] border border-white/10 bg-[#05070A] px-3 py-3 text-white outline-none focus:border-emerald-300/50"
            onChange={(event) => setWallet(event.target.value)}
            value={wallet}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Amount</span>
          <input
            className="rounded-[18px] border border-white/10 bg-[#05070A] px-3 py-3 text-white outline-none focus:border-emerald-300/50"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            value={amount}
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Currency</span>
          <select
            className="rounded-[18px] border border-white/10 bg-[#05070A] px-3 py-3 text-white outline-none focus:border-emerald-300/50"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          >
            <option>USDC</option>
            <option>USDT</option>
            <option>SOL</option>
            <option>TON</option>
            <option>EHKD</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Mock / manual tx hash</span>
          <input
            className="rounded-[18px] border border-white/10 bg-[#05070A] px-3 py-3 text-white outline-none focus:border-emerald-300/50"
            onChange={(event) => setTxHash(event.target.value)}
            value={txHash}
          />
        </label>
        <button
          className="rounded border border-emerald-300/40 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "pending" || Boolean(paymentIntent)}
          onClick={createPaymentIntent}
        >
          Create Payment Intent
        </button>
        <button
          className="rounded border border-sky-300/40 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "pending" || !paymentIntent || paymentIntent.status !== "awaiting_payment"}
          onClick={submitPayment}
        >
          Submit Mock Tx
        </button>
        <button
          className="rounded border border-amber-200/40 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "pending" || !paymentIntent || confirmed}
          onClick={simulateConfirmation}
        >
          Simulate Payment Confirmation
        </button>
        <button
          className="rounded bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={state === "pending" || !confirmed}
          onClick={plantAndEnter}
        >
          {state === "pending" ? "Planting..." : "Plant & Enter"}
        </button>
      </div>
      {paymentIntent ? (
        <div className="mt-5 rounded-[20px] border border-sky-300/30 bg-sky-300/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
            Payment Intent
          </div>
          <div className="mt-2 break-all text-sm font-semibold">{paymentIntent.id}</div>
          <div className="mt-2 text-sm text-slate-200">
            {paymentIntent.status} / {paymentIntent.amount} {paymentIntent.currency} / {paymentIntent.chain}
          </div>
          <p className="mt-2 break-all text-xs leading-5 text-sky-50/80">
            Expected recipient: {paymentIntent.expectedRecipient}
          </p>
          {paymentIntent.confirmedTxHash ? (
            <p className="mt-2 break-all text-xs text-emerald-100">Confirmed tx: {paymentIntent.confirmedTxHash}</p>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-amber-100">
            Testnet flow uses mock/manual/TON testnet placeholders only. No live mainnet transfer is executed here.
          </p>
        </div>
      ) : null}
      {state === "error" ? (
        <p className="mt-4 rounded bg-red-500/15 px-4 py-3 text-sm text-red-100">{message}</p>
      ) : null}
      {ticketSeed ? (
        <div className="mt-5 rounded-[20px] border border-emerald-300/30 bg-emerald-300/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
            Ticket Seed issued
          </div>
          <div className="mt-2 text-lg font-semibold">#{ticketSeed.ticket?.ticketNumber ?? "pending"}</div>
          <p className="mt-2 break-all text-xs leading-5 text-emerald-50/80">
            {ticketSeed.ticket?.receiptHash}
          </p>
        </div>
      ) : null}
    </WalletConnectCard>
  );
}
