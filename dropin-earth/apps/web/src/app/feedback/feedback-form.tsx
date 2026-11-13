"use client";

import { useState } from "react";
import { StatusBadge } from "@dropin/ui";
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

export function FeedbackForm({ locale = "en" }: { locale?: "en" | "zh" }) {
  const t = (en: string, cn: string) => locale === "zh" ? cn : en;
  const categoryLabels: Record<string, string> = { bug: "功能问题", payment: "测试支付", referral: "邀请链接", ui: "页面与文字", proof: "环境记录", risk: "风险提示", other: "其他" };
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (!message.trim()) {
      setError(t("Please describe the page and what happened.", "请说明哪个页面遇到了什么问题。"));
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
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
      setError(t("We could not confirm receipt. Your message is still here. Sending it again may create a duplicate.", "暂时无法确认是否收到反馈。填写内容仍在；再次发送可能产生重复记录。"));
      return;
    }
    setMessage("");
    setStatus("success");
    } catch {
      setStatus("error");
      setError(t("The connection was interrupted. We cannot confirm receipt, and your message is still here.", "连接中断，暂时无法确认是否收到反馈。填写内容仍在。"));
    }
  }

  return (
    <section className="grid gap-5 rounded-[24px] border border-cyan-300/20 bg-slate-900/70 p-6">
      <h2 className="text-2xl font-semibold">{t("Describe the issue", "说明你遇到的问题")}</h2>
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t("Category", "问题类型")}</span>
        <select
          className="rounded-[18px] border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-200/60"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {locale === "zh" ? categoryLabels[item.value] : item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t("What happened?", "发生了什么？")}</span>
        <textarea
          className="min-h-40 rounded-[18px] border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-200/60"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("Which page were you using? What did you expect, and what happened instead?", "你正在使用哪个页面？原本想完成什么，实际遇到了什么？")}
        />
      </label>
      <div className="rounded-[18px] border border-amber-200/20 bg-amber-200/10 p-4 text-sm leading-6 text-amber-100">
        {t("This feedback form uses the test service. Do not include children's personal information, passwords or wallet secrets. It is not an emergency reporting service.", "此反馈表单使用测试服务。请勿填写儿童个人信息、密码或钱包密钥。这里不受理紧急求助。") }
      </div>
      <button
        className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
        disabled={status === "submitting"}
        type="button"
        onClick={submit}
      >
        {status === "submitting" ? t("Sending…", "正在发送…") : t("Send feedback", "发送反馈")}
      </button>
      {status === "success" ? (
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          <StatusBadge status="success">{t("Received", "已收到")}</StatusBadge>
          {t("The test service received your feedback. This does not confirm that the issue is resolved.", "测试服务已收到反馈，不代表问题已解决。")}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <StatusBadge status="error">{t("Please review", "请检查")}</StatusBadge>
          {error}
        </p>
      ) : null}
    </section>
  );
}
