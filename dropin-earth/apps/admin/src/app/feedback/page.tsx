import Link from "next/link";
import { Card, ImpactMetricCard, StatusBadge } from "@dropin/ui";
import { getApi } from "../../lib/api";
import { ResolveFeedbackButton } from "./feedback-actions";

type FeedbackItem = {
  id: string;
  source: string;
  category: string;
  message: string;
  severity: string;
  status: string;
  campaignId?: string;
  roundId?: string;
  createdAt: string;
};

export default async function AdminFeedbackPage() {
  const feedback = await getApi<FeedbackItem[]>("/admin/feedback");

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <section className="mx-auto max-w-7xl px-5 py-8">
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 className="mt-5 text-5xl font-semibold leading-tight">Feedback Queue</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">
          Launch feedback is handled like an operational object: source, severity, resolution, and audit trail.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ImpactMetricCard label="Open feedback" value={String(feedback.filter((item) => item.status === "open").length)} />
          <ImpactMetricCard label="Resolved" value={String(feedback.filter((item) => item.status !== "open").length)} />
          <ImpactMetricCard label="Operational mode" value="audit logged" status="pass" />
        </div>
        <div style={{ display: "grid", gap: 14, marginTop: 28 }}>
          {feedback.map((item) => (
            <Card key={item.id} tone="dark">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>{item.category}</h2>
                  <p style={{ color: "#D8E8F2", lineHeight: 1.6 }}>{item.message}</p>
                  <p style={{ color: "#7E91A2", fontSize: 12 }}>{item.source} / {item.createdAt}</p>
                </div>
                <StatusBadge status={item.status}>{item.status}</StatusBadge>
              </div>
              {item.status === "open" ? (
                <div style={{ marginTop: 14 }}>
                  <ResolveFeedbackButton feedbackId={item.id} />
                </div>
              ) : null}
            </Card>
          ))}
          {feedback.length === 0 ? <Card tone="dark">No feedback yet.</Card> : null}
        </div>
      </section>
    </main>
  );
}
