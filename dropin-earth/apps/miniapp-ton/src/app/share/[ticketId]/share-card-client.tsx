"use client";

import { useState } from "react";
import { apiBaseUrl, type ApiResponse } from "@/lib/api";

type ShareResponse = {
  referral: {
    code: string;
  };
  shareCard: {
    id: string;
    title: string;
    copy: string;
    url: string;
  };
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      openTelegramLink?: (url: string) => void;
    };
  };
};

export function ShareCardClient({ roundId, ticketId }: { roundId: string; ticketId: string }) {
  const [share, setShare] = useState<ShareResponse | undefined>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createShareCard() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/telegram/share-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          roundId,
          ownerUserId: "demo-user",
        }),
      });
      const payload = (await response.json()) as ApiResponse<ShareResponse>;
      if (!payload.ok) throw new Error(payload.error);
      setShare(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Share card failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareToTelegram() {
    if (!share) return;
    const text = encodeURIComponent(`${share.shareCard.copy}\n${share.shareCard.url}`);
    const url = `https://t.me/share/url?url=${encodeURIComponent(share.shareCard.url)}&text=${text}`;
    const telegram = (window as TelegramWindow).Telegram?.WebApp;
    if (telegram?.openTelegramLink) {
      telegram.openTelegramLink(url);
      return;
    }
    await navigator.clipboard.writeText(`${share.shareCard.copy}\n${share.shareCard.url}`);
    setMessage("Share link copied.");
  }

  return (
    <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Climate Proof Card</h2>
      <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>
        Invite a friend to co-plant. Phase 9 rewards are placeholder Leaf Points only.
      </p>
      <button className="mini-button secondary" disabled={busy || Boolean(share)} onClick={createShareCard} type="button">
        {busy ? "Creating..." : "Generate Co-Plant Link"}
      </button>
      {share ? (
        <div style={{ border: "1px solid rgb(0 200 83 / 28%)", padding: 12 }}>
          <div className="mini-label">Referral code</div>
          <strong style={{ color: "#DDFBE8", display: "block", marginTop: 4 }}>{share.referral.code}</strong>
          <p style={{ color: "#D8E8F2", lineHeight: 1.5 }}>{share.shareCard.copy}</p>
          <div style={{ overflowWrap: "anywhere", color: "#00E5FF", fontSize: 12 }}>{share.shareCard.url}</div>
        </div>
      ) : null}
      <button className="mini-button" disabled={!share} onClick={shareToTelegram} type="button">
        Share in Telegram
      </button>
      {message ? <p style={{ color: message.includes("copied") ? "#DDFBE8" : "#ffb4b4", margin: 0 }}>{message}</p> : null}
    </section>
  );
}
