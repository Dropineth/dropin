"use client";

import { useState } from "react";
import { apiBaseUrl } from "../../lib/api";

export function ResolveFeedbackButton({ feedbackId }: { feedbackId: string }) {
  const [state, setState] = useState<"idle" | "resolving" | "done" | "error">("idle");

  async function resolve() {
    setState("resolving");
    const response = await fetch(`${apiBaseUrl}/admin/feedback/${feedbackId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor: "admin-ui",
        resolution: "Reviewed during public testnet readiness.",
      }),
    });
    setState(response.ok ? "done" : "error");
  }

  return (
    <button
      style={{ background: "#00C853", border: 0, color: "#05070A", fontWeight: 800, padding: "10px 14px" }}
      disabled={state === "resolving" || state === "done"}
      type="button"
      onClick={resolve}
    >
      {state === "done" ? "Resolved" : state === "resolving" ? "Resolving..." : state === "error" ? "Retry resolve" : "Resolve"}
    </button>
  );
}
