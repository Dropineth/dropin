"use client";

import { useState } from "react";
import { FeedbackFormShell, StatusBadge } from "@dropin/ui";
import { apiBaseUrl } from "@/lib/api";

const categories = [
  { value: "bug", label: "Bug" },
  { value: "payment", label: "Payment" },
  { value: "referral", label: "Referral" },
  { value: "ui", label: "UI" },
  { value: "proof", label: "Proof" },
  { value: "risk", label: "Risk" },
  { value: "other", label: "Other" },
];

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (!message.trim()) {
      setError("Please describe what happened.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError("");
    const response = await fetch(`${apiBaseUrl}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "web",
        userId: "demo-user",
        page: "/feedback",
        category,
        severity: "low",
        message,
      }),
    });
    if (!response.ok) {
      setStatus("error");
      setError("Feedback could not be submitted.");
      return;
    }
    setMessage("");
    setStatus("success");
  }

  return (
    <FeedbackFormShell status={status === "idle" ? "open" : status}>
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Category</span>
        <select
          className="rounded-[18px] border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-200/60"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Message</span>
        <textarea
          className="min-h-40 rounded-[18px] border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-200/60"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell the launch team what felt broken, confusing, risky, or ready."
        />
      </label>
      <div className="rounded-[18px] border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-100">
        Testnet-only feedback queue. Do not submit private keys, seed phrases, or mainnet transfer details.
      </div>
      <button
        className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
        disabled={status === "submitting"}
        type="button"
        onClick={submit}
      >
        {status === "submitting" ? "Submitting..." : "Send feedback"}
      </button>
      {status === "success" ? (
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          <StatusBadge status="success">success</StatusBadge>
          Feedback recorded for launch review.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <StatusBadge status="error">error</StatusBadge>
          {error}
        </p>
      ) : null}
    </FeedbackFormShell>
  );
}
