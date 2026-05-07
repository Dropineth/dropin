import Link from "next/link";
import { AdminReadinessPanel, Card, ImpactMetricCard, StatusBadge } from "@dropin/ui";
import { getApi } from "../../lib/api";
import { LaunchCheckClient } from "./launch-check-client";

type ReadinessReport = {
  campaignId: string;
  decision: "pass" | "warn" | "fail";
  ready: boolean;
  checkedAt: string;
  system: {
    counts: {
      pendingPaymentIntents: number;
      stalePaymentIntents: number;
      openRiskEvents: number;
      openChallenges: number;
      criticalHighChallenges: number;
    };
  };
  checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }>;
};

export default async function AdminLaunchPage() {
  const report = await getApi<ReadinessReport>("/admin/launch/readiness");

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <section className="mx-auto max-w-7xl px-5 py-8">
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge status={report.decision}>{report.decision}</StatusBadge>
          <StatusBadge status={report.ready ? "pass" : "warn"}>{report.ready ? "ready" : "not ready"}</StatusBadge>
        </div>
        <h1 className="mt-5 text-5xl font-semibold leading-tight">Launch Readiness</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">
          Final gate for the public testnet campaign. Launch checks are recorded with audit logs so the team can see
          what was known before opening the campaign.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ImpactMetricCard label="Open risk events" value={String(report.system.counts.openRiskEvents)} status={report.system.counts.openRiskEvents ? "warn" : "pass"} />
          <ImpactMetricCard label="Open challenges" value={String(report.system.counts.openChallenges)} status={report.system.counts.openChallenges ? "warn" : "pass"} />
          <ImpactMetricCard label="Pending payments" value={String(report.system.counts.pendingPaymentIntents)} detail={`${report.system.counts.stalePaymentIntents} stale intents`} status={report.system.counts.stalePaymentIntents ? "warn" : "pass"} />
        </div>
        <Card className="mt-6" tone="dark">
          <div style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>Launch gate action</h2>
            <LaunchCheckClient campaignId={report.campaignId} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/feedback" style={linkStyle}>Feedback queue</Link>
              <Link href="/risk" style={linkStyle}>Risk queue</Link>
              <Link href="/challenges" style={linkStyle}>Challenge queue</Link>
            </div>
          </div>
        </Card>
        <div className="mt-6">
          <AdminReadinessPanel checks={report.checks} decision={report.decision} ready={report.ready} />
        </div>
      </section>
    </main>
  );
}

const linkStyle = { color: "#00E5FF", fontWeight: 800 };
