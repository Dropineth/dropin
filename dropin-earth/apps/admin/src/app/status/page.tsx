import Link from "next/link";
import { Card, ImpactMetricCard, StatusBadge } from "@dropin/ui";
import { getApi } from "../../lib/api";

type SystemStatus = {
  status?: string;
  repositoryMode: string;
  paymentMode: string;
  tonTestnet: { enabled: boolean; treasuryConfigured?: boolean; configured?: boolean };
  anchor: { configured: boolean; programId?: string };
  counts: Record<string, number>;
};

export default async function AdminStatusPage() {
  const status = await getApi<SystemStatus>("/status/system");
  const countEntries = Object.entries(status.counts);
  const systemStatus = status.status ?? "ok";
  const tonTreasuryConfigured = status.tonTestnet.treasuryConfigured ?? status.tonTestnet.configured ?? false;

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <section className="mx-auto max-w-7xl px-5 py-8">
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge status={systemStatus}>{systemStatus}</StatusBadge>
          <StatusBadge status={status.tonTestnet.enabled ? "pass" : "warn"}>{status.tonTestnet.enabled ? "TON enabled" : "TON disabled"}</StatusBadge>
        </div>
        <h1 className="mt-5 text-5xl font-semibold leading-tight">System Status</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">
          Operational view for repository mode, payment mode, TON testnet configuration, Solana anchor configuration,
          and open launch queues.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ImpactMetricCard label="Repository mode" value={status.repositoryMode} />
          <ImpactMetricCard label="Payment mode" value={status.paymentMode} />
          <ImpactMetricCard label="Anchor config" value={status.anchor.configured ? "configured" : "missing"} status={status.anchor.configured ? "pass" : "warn"} />
        </div>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 18 }}>
          <Card tone="dark">
            <Metric label="System" value={systemStatus} />
            <Metric label="Repository" value={status.repositoryMode} />
            <Metric label="Payment mode" value={status.paymentMode} />
          </Card>
          <Card tone="dark">
            <Metric label="TON testnet" value={status.tonTestnet.enabled ? "enabled" : "disabled"} />
            <Metric label="TON treasury" value={tonTreasuryConfigured ? "configured" : "not configured"} />
            <Metric label="Anchor" value={status.anchor.configured ? "configured" : "missing"} />
          </Card>
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 18 }}>
          {countEntries.map(([label, value]) => (
            <Card key={label} tone="dark">
              <Metric label={label} value={String(value)} />
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
