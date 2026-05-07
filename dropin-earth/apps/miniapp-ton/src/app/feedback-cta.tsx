"use client";

import { useState } from "react";
import { apiBaseUrl } from "@/lib/api";

export function FeedbackCta({ campaignId, roundId, page }: { campaignId?: string | undefined; roundId?: string | undefined; page: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendFeedback() {
    setState("sending");
    const response = await fetch(`${apiBaseUrl}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "miniapp",
        userId: "demo-user",
        campaignId,
        roundId,
        page,
        category: "miniapp_testnet_feedback",
        severity: "low",
        message: "Mini App user requested launch team review for this screen.",
      }),
    });
    setState(response.ok ? "sent" : "error");
  }

  return (
    <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <h2 style={{ margin: 0, fontSize: 19 }}>Launch Feedback</h2>
      <p style={{ color: "#AFC2D1", lineHeight: 1.5, margin: 0 }}>
        Send a lightweight signal to the testnet launch team if this flow feels broken, risky, or unclear.
      </p>
      <button className="mini-button secondary" disabled={state === "sending" || state === "sent"} type="button" onClick={sendFeedback}>
        {state === "sent" ? "Feedback sent" : state === "sending" ? "Sending..." : state === "error" ? "Retry feedback" : "Send feedback"}
      </button>
    </section>
  );
}
