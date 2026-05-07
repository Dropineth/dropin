"use client";

import { useState } from "react";
import { apiBaseUrl } from "../../lib/api";

export function LaunchCheckClient({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [decision, setDecision] = useState("");

  async function runCheck() {
    setState("running");
    const response = await fetch(`${apiBaseUrl}/admin/launch/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actor: "admin-ui", campaignId }),
    });
    if (!response.ok) {
      setState("error");
      return;
    }
    const payload = (await response.json()) as { ok: boolean; data?: { decision?: string } };
    setDecision(payload.data?.decision ?? "recorded");
    setState("done");
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <button
        style={{ background: "#00C853", border: 0, color: "#05070A", fontWeight: 800, padding: "12px 16px" }}
        disabled={state === "running"}
        type="button"
        onClick={runCheck}
      >
        {state === "running" ? "Running..." : "Run launch check"}
      </button>
      {state === "done" ? <span style={{ color: "#8EF5B2", fontWeight: 700 }}>Launch check saved: {decision}</span> : null}
      {state === "error" ? <span style={{ color: "#FF9AA2", fontWeight: 700 }}>Launch check failed</span> : null}
    </div>
  );
}
