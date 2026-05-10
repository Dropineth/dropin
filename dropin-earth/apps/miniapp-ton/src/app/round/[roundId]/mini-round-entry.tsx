"use client";

import { useMemo, useState } from "react";
import type { PaymentIntent } from "@dropin/schemas";
import { MiniStatusCard } from "@/components/ui";
import { miniappApi, postApi } from "@/lib/api";

type TicketSeed = {
  entry: { id: string; paymentIntentId?: string };
  ticket?: { id: string; ticketNumber: number; receiptHash: string };
};

type PaymentInstructions = {
  paymentIntentId: string;
  chain: string;
  network?: string;
  currency: string;
  amount: string;
  recipient: string;
  memo?: string;
  paymentNonce?: string;
  expiresAt: string;
};

type VerifyResult = {
  intent: PaymentIntent;
  verification: {
    status: "confirmed" | "failed" | "pending";
    failureReason?: string;
    rawPayloadHash?: string;
  };
};

export function MiniRoundEntry({ roundId, regionId, amount, currency }: { roundId: string; regionId: string; amount: string; currency: string }) {
  const [wallet, setWallet] = useState("ton_testnet_wallet_dropin_demo");
  const [selectedCurrency, setSelectedCurrency] = useState<"USDC" | "TON">(currency === "TON" ? "TON" : "USDC");
  const [intent, setIntent] = useState<PaymentIntent | undefined>();
  const [instructions, setInstructions] = useState<PaymentInstructions | undefined>();
  const [ticket, setTicket] = useState<TicketSeed | undefined>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submittedTxHash, setSubmittedTxHash] = useState("");
  const txHash = useMemo(() => `ton_testnet_mock_${roundId}_${Date.now()}`, [roundId]);
  const paymentKey = useMemo(() => `miniapp-payment-${roundId}-${Date.now()}`, [roundId]);
  const entryKey = useMemo(() => `miniapp-entry-${roundId}-${Date.now()}`, [roundId]);
  const isTonTestnet = selectedCurrency === "TON";
  const paymentAmount = amount;
  const paymentStatus = intent?.status ?? (message && !intent ? "failed" : "not_created");
  const paymentTone = statusTone(paymentStatus);
  const ticketStatus = ticket ? "success" : busy && intent?.status === "confirmed" ? "generating" : message && intent?.status === "confirmed" ? "failed" : "pending";
  const ticketTone = statusTone(ticketStatus);

  async function createPaymentIntent() {
    setBusy(true);
    setMessage("");
    setIntent(undefined);
    setInstructions(undefined);
    setTicket(undefined);
    try {
      const created = await miniappApi.createPaymentIntent({
        userId: "demo-user",
        wallet,
        purpose: "lottery_entry",
        purposeId: roundId,
        chain: isTonTestnet ? "ton" : "manual",
        currency: selectedCurrency,
        amount: paymentAmount,
        idempotencyKey: paymentKey,
        metadata: { source: "telegram_miniapp", adapter: isTonTestnet ? "ton_testnet" : "manual_mock" },
      });
      setIntent(created.intent);
      if (isTonTestnet) {
        const paymentInstructions = await miniappApi.paymentInstructions(created.intent.id) as PaymentInstructions;
        setInstructions(paymentInstructions);
        setSubmittedTxHash(txHash);
      } else {
        await miniappApi.submitPaymentIntent(created.intent.id, {
          txHash,
          observedAmount: paymentAmount,
          observedCurrency: selectedCurrency,
          submittedBy: "telegram-miniapp",
        });
        const confirmed = await postApi<PaymentIntent>(`/admin/payments/${created.intent.id}/confirm`, {
          actor: "telegram-miniapp-mock",
          confirmedTxHash: txHash,
          observedAmount: paymentAmount,
          observedCurrency: selectedCurrency,
        });
        setIntent(confirmed);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment Intent failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTonPayment() {
    if (!intent || !submittedTxHash) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await miniappApi.verifyPaymentIntent(intent.id, {
        txHash: submittedTxHash,
        actor: "telegram-miniapp-ton-testnet",
      }) as VerifyResult;
      setIntent(result.intent);
      if (result.verification.status !== "confirmed") {
        setMessage(result.verification.failureReason ?? `TON verification ${result.verification.status}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TON verification failed closed");
    } finally {
      setBusy(false);
    }
  }

  async function plantAndEnter() {
    if (!intent) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await miniappApi.enterRound(roundId, {
        userId: "demo-user",
        wallet,
        amount: paymentAmount,
        currency: selectedCurrency,
        regionId,
        paymentIntentId: intent.id,
        antiSybilScore: 72,
        idempotencyKey: entryKey,
      }) as TicketSeed;
      setTicket(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Plant & Enter failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 14 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Plant & Enter</h2>
      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <span style={{ color: "#AFC2D1" }}>TON wallet mock</span>
        <input
          onChange={(event) => setWallet(event.target.value)}
          style={{ background: "#05070A", border: "1px solid rgb(255 255 255 / 12%)", color: "white", padding: 12 }}
          value={wallet}
        />
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <span style={{ color: "#AFC2D1" }}>Payment rail</span>
        <select
          onChange={(event) => setSelectedCurrency(event.target.value === "TON" ? "TON" : "USDC")}
          style={{ background: "#05070A", border: "1px solid rgb(255 255 255 / 12%)", color: "white", padding: 12 }}
          value={selectedCurrency}
        >
          <option value="USDC">USDC mock/manual</option>
          <option value="TON">TON testnet verification</option>
        </select>
      </label>
      <button className="mini-button secondary" disabled={busy || Boolean(intent)} onClick={createPaymentIntent} type="button">
        {busy ? "Processing..." : `Create ${selectedCurrency} Payment Intent`}
      </button>
      <MiniStatusCard
        badge={selectedCurrency}
        detail={intent ? `${intent.amount} ${intent.currency}` : `${paymentAmount} ${selectedCurrency}`}
        label="Payment Intent Status"
        tone={paymentTone}
        value={paymentStatus.replaceAll("_", " ").toUpperCase()}
      >
        {intent ? (
          <>
            <CopyLine label="Intent ID" value={intent.id} />
            {intent.confirmedTxHash ? <CopyLine label="Confirmed tx" value={intent.confirmedTxHash} /> : null}
            {intent.confirmedRawPayloadHash ? <CopyLine label="Raw payload hash" value={intent.confirmedRawPayloadHash} /> : null}
          </>
        ) : null}
      </MiniStatusCard>
      {instructions ? (
        <div style={{ border: "1px solid rgb(212 175 55 / 28%)", color: "#F2DCA0", padding: 12 }}>
          <strong>TON testnet instructions</strong>
          <CopyLine label="Recipient" value={instructions.recipient} />
          <CopyLine label="Amount" value={`${instructions.amount} ${instructions.currency}`} />
          <CopyLine label="Memo" value={instructions.memo ?? "missing"} />
          <CopyLine label="Expires" value={new Date(instructions.expiresAt).toLocaleString()} />
        </div>
      ) : null}
      {isTonTestnet && intent && intent.status !== "confirmed" ? (
        <>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <span style={{ color: "#AFC2D1" }}>Submitted TON testnet tx hash</span>
            <input
              onChange={(event) => setSubmittedTxHash(event.target.value)}
              style={{ background: "#05070A", border: "1px solid rgb(255 255 255 / 12%)", color: "white", padding: 12 }}
              value={submittedTxHash}
            />
          </label>
          <button className="mini-button secondary" disabled={busy || !submittedTxHash} onClick={verifyTonPayment} type="button">
            Verify TON Testnet Payment
          </button>
        </>
      ) : null}
      <button className="mini-button" disabled={busy || intent?.status !== "confirmed" || Boolean(ticket)} onClick={plantAndEnter} type="button">
        Plant & Enter
      </button>
      <MiniStatusCard
        badge={ticketStatus}
        detail={ticket?.ticket?.receiptHash ?? "Receipt hash appears after a confirmed Payment Intent enters the round."}
        label="Ticket Seed"
        tone={ticketTone}
        value={ticket ? `Ticket Seed #${ticket.ticket?.ticketNumber ?? "issued"}` : intent?.status === "confirmed" ? "Ready to generate" : "Waiting for confirmed payment"}
      />
      {message ? <p style={{ color: "#ffb4b4", margin: 0 }}>{message}</p> : null}
    </section>
  );
}

function statusTone(status: string): "green" | "blue" | "gold" | "red" | "muted" {
  if (status === "confirmed" || status === "success") return "green";
  if (status === "failed") return "red";
  if (status === "pending" || status === "generating") return "gold";
  if (status === "not_created") return "muted";
  return "blue";
}

function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="mini-label">{label}</div>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        style={{
          background: "transparent",
          border: 0,
          color: "#F2DCA0",
          marginTop: 3,
          overflowWrap: "anywhere",
          padding: 0,
          textAlign: "left",
          width: "100%",
        }}
        type="button"
      >
        {value}
      </button>
    </div>
  );
}
