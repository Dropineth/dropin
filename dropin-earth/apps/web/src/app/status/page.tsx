import {
  AdminReadinessPanel,
  AppShell,
  Card,
  ImpactMetricCard,
  ProofTimeline,
  StatusBadge,
} from "@dropin/ui";
import { getApi } from "@/lib/api";

type SystemStatus = {
  status?: "ok" | "warn" | "fail";
  repositoryMode: string;
  paymentMode: string;
  tonTestnet: {
    enabled: boolean;
    treasuryConfigured?: boolean;
    configured?: boolean;
  };
  anchor: {
    configured: boolean;
    programId?: string;
  };
  counts: {
    campaigns: number;
    liveCampaigns: number;
    lotteryRoundsOpen: number;
    paymentIntentsPending?: number;
    pendingPaymentIntents?: number;
    stalePaymentIntents: number;
    openRiskEvents: number;
    openChallenges: number;
    criticalHighChallenges: number;
    openFeedback: number;
  };
};

type ReadinessReport = {
  campaignId: string;
  decision: "pass" | "warn" | "fail";
  ready: boolean;
  checks: Array<{
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
};

export default async function StatusPage() {
  const [status, readiness] = await Promise.all([
    getApi<SystemStatus>("/status/system"),
    getApi<ReadinessReport>("/admin/launch/readiness"),
  ]);
  const systemStatus = status.status ?? "ok";
  const pendingPaymentIntents = status.counts.paymentIntentsPending ?? status.counts.pendingPaymentIntents ?? 0;
  const tonTreasuryConfigured = status.tonTestnet.treasuryConfigured ?? status.tonTestnet.configured ?? false;

  return (
    <AppShell
      nav={
        <>
          <a href="/campaigns/campaign_v1_ggw_testnet">Campaign</a>
          <a href="/feedback">Feedback</a>
          <a href="/red-team">Red Team</a>
        </>
      }
    >
      <section className="grid gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={systemStatus}>{systemStatus}</StatusBadge>
            <StatusBadge status={readiness.decision}>{readiness.decision}</StatusBadge>
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Launch Status</p>
          <h1 className="mt-3 text-5xl font-semibold">Public Testnet Readiness</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Premium status dashboard for API readiness, repository mode, payment mode, TON testnet configuration,
            campaign count, open risk events, open challenge cases, and reconciliation health.
          </p>
        </div>
        <Card tone="dark">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="API readiness" value={systemStatus} />
            <Metric label="Repository mode" value={status.repositoryMode} />
            <Metric label="Payment mode" value={status.paymentMode} />
          </div>
        </Card>
      </section>

      <section className="grid gap-3 pb-8 md:grid-cols-3 lg:grid-cols-6">
        <ImpactMetricCard label="TON testnet" value={status.tonTestnet.enabled ? "enabled" : "disabled"} detail={tonTreasuryConfigured ? "Treasury configured" : "Treasury not configured"} status={status.tonTestnet.enabled ? "ready" : "warn"} />
        <ImpactMetricCard label="Campaigns live" value={String(status.counts.liveCampaigns)} detail={`${status.counts.campaigns} total campaigns`} />
        <ImpactMetricCard label="Open rounds" value={String(status.counts.lotteryRoundsOpen)} detail="Tree Lotto rounds accepting entries" />
        <ImpactMetricCard label="Pending intents" value={String(pendingPaymentIntents)} detail={`${status.counts.stalePaymentIntents} stale`} status={status.counts.stalePaymentIntents ? "warn" : "ok"} />
        <ImpactMetricCard label="Open risk events" value={String(status.counts.openRiskEvents)} detail="Risk queue" status={status.counts.openRiskEvents ? "warn" : "ok"} />
        <ImpactMetricCard label="Open challenges" value={String(status.counts.openChallenges)} detail={`${status.counts.criticalHighChallenges} critical/high`} status={status.counts.criticalHighChallenges ? "fail" : "ok"} />
      </section>

      <section className="grid gap-6 pb-12 lg:grid-cols-[1.1fr_0.9fr]">
        <AdminReadinessPanel checks={readiness.checks} decision={readiness.decision} ready={readiness.ready} />
        <ProofTimeline
          items={[
            { label: "Anchor config status", value: status.anchor.configured ? status.anchor.programId ?? "Configured" : "Missing", status: status.anchor.configured ? "pass" : "warn" },
            { label: "Last reconciliation time", value: "Available through payment reconciliation reports", status: "pending" },
            { label: "Feedback open", value: String(status.counts.openFeedback), status: status.counts.openFeedback ? "warn" : "pass" },
          ]}
        />
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-2xl font-semibold">{value}</div>
    </div>
  );
}
