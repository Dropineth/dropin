import type { ComponentPropsWithoutRef, ReactNode } from "react";

export const climateTokens = {
  deepSpace: "#05070A",
  earthNavy: "#081827",
  climateBlue: "#1E88E5",
  canopyGreen: "#00C853",
  mossGreen: "#2E7D32",
  carbonGold: "#D4AF37",
  mistWhite: "#F5F7FA",
  softGray: "#AAB4C0",
  alertRed: "#FF4D4F",
  warningAmber: "#F6A609",
  cyanTrace: "#00E5FF",
} as const;

export const allocationModel = {
  winner: 70,
  verifiedReforestation: 20,
  operations: 10,
} as const;

type CardProps = ComponentPropsWithoutRef<"article"> & {
  tone?: "dark" | "light";
};

export function Card({ className = "", tone = "light", ...props }: CardProps) {
  const palette =
    tone === "dark"
      ? "border-white/10 bg-white/[0.06] text-white shadow-[0_18px_80px_rgb(0_0_0/0.24)]"
      : "border-slate-200 bg-white text-slate-950 shadow-sm";

  return (
    <article
      className={`rounded-[22px] border p-5 backdrop-blur ${palette} ${className}`}
      {...props}
    />
  );
}

type ButtonProps = ComponentPropsWithoutRef<"a"> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function ButtonLink({ className = "", variant = "primary", ...props }: ButtonProps) {
  const palette = {
    primary: "bg-emerald-400 text-slate-950 hover:bg-emerald-300",
    secondary: "border border-amber-300/70 text-amber-100 hover:bg-amber-300/10",
    ghost: "border border-sky-300/50 text-sky-100 hover:bg-sky-300/10",
  }[variant];

  return (
    <a
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${palette} ${className}`}
      {...props}
    />
  );
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.05] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200/70">
        {label}
      </div>
      <div className="mt-2 break-words text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-1 text-sm text-slate-300">{detail}</div> : null}
    </div>
  );
}

export function AppShell({
  children,
  eyebrow = "Dropin Earth",
  nav,
  className = "",
}: {
  children: ReactNode;
  eyebrow?: string;
  nav?: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`min-h-screen bg-[#05070A] text-white ${className}`}
      style={{
        background:
          "radial-gradient(circle at 15% 8%, rgb(30 136 229 / 0.20), transparent 34%), radial-gradient(circle at 86% 12%, rgb(0 200 83 / 0.16), transparent 30%), #05070A",
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-white/10 pb-4">
          <a className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
            {eyebrow}
          </a>
          {nav ? <nav className="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-300">{nav}</nav> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

export function MobileFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-[430px] rounded-[34px] border border-white/10 bg-[#081827]/80 p-3 shadow-[0_24px_100px_rgb(0_0_0/0.38)] ${className}`}>
      <div className="min-h-[720px] rounded-[26px] border border-white/10 bg-[#05070A] p-4">
        {children}
      </div>
    </section>
  );
}

export function HeroEarthOrb({
  label = "Dropin Earth proof orb",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-label={label}
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#081827] ${compact ? "min-h-64" : "min-h-[440px]"}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgb(30_136_229/0.28),transparent_52%)]" />
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-[radial-gradient(circle_at_35%_28%,rgb(245_247_250/0.72),transparent_0_7%,transparent_10%),radial-gradient(circle_at_38%_47%,rgb(0_200_83/0.84),transparent_0_13%,transparent_24%),radial-gradient(circle_at_68%_56%,rgb(0_200_83/0.58),transparent_0_16%,transparent_28%),radial-gradient(circle_at_50%_50%,#1E88E5,#0A3552_62%,#04111B_74%)] shadow-[0_0_90px_rgb(30_136_229/0.52)] sm:h-80 sm:w-80" />
      <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
      <div className="absolute bottom-6 left-6 right-6 rounded-[20px] border border-white/10 bg-black/30 p-4 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Proof layer online</div>
        <div className="mt-2 text-sm leading-6 text-slate-200">
          Climate pools, verified reforestation, and challengeable proof roots in one public testnet interface.
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({
  status,
  children,
  className = "",
}: {
  status: string;
  children?: ReactNode;
  className?: string;
}) {
  const normalized = status.toLowerCase();
  const tone =
    ["pass", "ok", "ready", "open", "live", "confirmed", "finalized", "issued", "resolved"].includes(normalized)
      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-200"
      : ["warn", "pending", "scheduled", "manual_review", "delayed", "draft"].includes(normalized)
        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
        : ["fail", "error", "blocked", "challenged", "rejected", "revoked"].includes(normalized)
          ? "border-red-300/35 bg-red-400/10 text-red-100"
          : "border-sky-300/30 bg-sky-300/10 text-sky-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${tone} ${className}`}>
      {children ?? status}
    </span>
  );
}

export function AllocationBreakdown({
  title = "Pool Allocation",
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  const rows = [
    { label: "Winner", value: allocationModel.winner, tone: "bg-[#D4AF37]" },
    { label: "Verified Reforestation", value: allocationModel.verifiedReforestation, tone: "bg-[#00C853]" },
    { label: "Dropin Operations", value: allocationModel.operations, tone: "bg-[#1E88E5]" },
  ];

  return (
    <Card tone="dark" className={compact ? "p-4" : ""}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <StatusBadge status="ready">70/20/10</StatusBadge>
      </div>
      <div className="mt-5 overflow-hidden rounded-full border border-white/10 bg-white/10">
        <div className="flex h-3">
          {rows.map((row) => (
            <div key={row.label} className={row.tone} style={{ width: `${row.value}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={row.label}>
            <span className="text-slate-300">{row.label}</span>
            <strong className="text-white">{row.value}%</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ImpactMetricCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  status?: string;
}) {
  return (
    <Card tone="dark" className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
        {status ? <StatusBadge status={status}>{status}</StatusBadge> : null}
      </div>
      <div className="mt-3 break-words text-3xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-slate-300">{detail}</div> : null}
    </Card>
  );
}

export function PrizePoolCard({
  title,
  poolSize,
  ticketPrice,
  entries,
  status,
}: {
  title: string;
  poolSize: string;
  ticketPrice: string;
  entries: string;
  status: string;
}) {
  return (
    <Card tone="dark" className="relative overflow-hidden">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Active Draw</p>
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        </div>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Prize Pool" value={poolSize} detail="70% winner allocation" />
        <Metric label="Ticket" value={ticketPrice} detail="Payment Intent required" />
        <Metric label="Entries" value={entries} detail="Frozen at close" />
      </div>
    </Card>
  );
}

export function DrawCountdown({ closesAt }: { closesAt: string }) {
  const closeDate = new Date(closesAt);
  return (
    <Card tone="dark">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Draw Countdown</div>
      <div className="mt-2 text-2xl font-semibold">{Number.isNaN(closeDate.getTime()) ? "Pending" : closeDate.toLocaleDateString()}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Entries freeze before randomness is computed. No casino spinner, only deterministic proof steps.
      </p>
    </Card>
  );
}

export function DrawProgress({
  steps,
}: {
  steps: ReadonlyArray<{ label: string; status: "complete" | "current" | "pending" }>;
}) {
  return (
    <Card tone="dark">
      <h2 className="text-lg font-semibold">Drawing In Progress</h2>
      <div className="mt-5 grid gap-3">
        {steps.map((step, index) => (
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[18px] border border-white/10 bg-[#05070A] p-3" key={step.label}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${step.status === "complete" ? "bg-emerald-300 text-slate-950" : step.status === "current" ? "bg-amber-300 text-slate-950" : "bg-white/10 text-slate-400"}`}>
              {index + 1}
            </div>
            <span className="text-sm text-slate-200">{step.label}</span>
            <StatusBadge status={step.status}>{step.status}</StatusBadge>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function WinnerResultCard({
  won,
  prize,
  impact,
  leafPoints,
}: {
  won: boolean;
  prize: string;
  impact: string;
  leafPoints: string;
}) {
  return (
    <Card tone="dark" className="border-emerald-300/20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Earth Response</p>
      <h2 className="mt-3 text-3xl font-semibold">{won ? "Winner confirmed" : "No prize this round"}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {won
          ? "Prize result, climate allocation, and proof roots are visible for review."
          : "Your seed still funded verified reforestation allocation and remains part of the proof timeline."}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Prize result" value={prize} />
        <Metric label="Impact allocation" value={impact} />
        <Metric label="Leaf Points" value={leafPoints} />
      </div>
    </Card>
  );
}

export function TicketCard({
  ticketNumber,
  status,
  receiptHash,
}: {
  ticketNumber: string;
  status: string;
  receiptHash?: string;
}) {
  return (
    <Card tone="dark" className="border-cyan-300/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Ticket Seed</div>
          <div className="mt-2 text-3xl font-semibold">{ticketNumber}</div>
        </div>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
      {receiptHash ? <p className="mt-4 break-all text-xs leading-5 text-slate-300">{receiptHash}</p> : null}
    </Card>
  );
}

export function ParticipationHistory({
  items,
}: {
  items: Array<{ title: string; status: string; detail: string; href?: string }>;
}) {
  return (
    <Card tone="dark">
      <h2 className="text-lg font-semibold">My Participated</h2>
      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <a className="rounded-[18px] border border-white/10 bg-[#05070A] p-4 transition hover:border-cyan-200/40" href={item.href ?? "#"} key={`${item.title}:${item.status}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                </div>
                <StatusBadge status={item.status}>{item.status}</StatusBadge>
              </div>
            </a>
          ))
        ) : (
          <div className="rounded-[18px] border border-white/10 bg-[#05070A] p-4 text-sm text-slate-300">
            No participation yet. Join an active draw to create your first Ticket Seed.
          </div>
        )}
      </div>
    </Card>
  );
}

export function ProofTimeline({
  items,
  disclaimer,
}: {
  items: Array<{ label: string; value: string; status?: string }>;
  disclaimer?: string;
}) {
  return (
    <Card tone="dark">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Impact Proof</p>
          <h2 className="mt-2 text-xl font-semibold">Traceable proof path</h2>
        </div>
        <StatusBadge status="challengeable">Challengeable</StatusBadge>
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div className="rounded-[18px] border border-white/10 bg-[#05070A] p-4" key={item.label}>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
              {item.status ? <StatusBadge status={item.status}>{item.status}</StatusBadge> : null}
            </div>
            <div className="mt-2 break-all text-sm text-slate-200">{item.value}</div>
          </div>
        ))}
      </div>
      {disclaimer ? (
        <p className="mt-5 rounded-[18px] border border-amber-200/25 bg-amber-200/10 p-4 text-sm leading-6 text-amber-100">
          {disclaimer}
        </p>
      ) : null}
    </Card>
  );
}

export function WalletConnectCard({
  status,
  wallet,
  children,
}: {
  status: "disconnected" | "connecting" | "connected" | "unsupported" | "error";
  wallet?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <Card tone="dark" className="border-emerald-300/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Connect Wallet</p>
          <h2 className="mt-2 text-2xl font-semibold">{wallet ? "Testnet wallet connected" : "Payment Intent wallet"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Testnet flows use Payment Intent and TON testnet placeholders. Dropin never asks for private keys.
          </p>
        </div>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
      {wallet ? <p className="mt-4 break-all rounded-[16px] border border-white/10 bg-[#05070A] p-3 text-xs text-slate-300">{wallet}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </Card>
  );
}

export function FeedbackFormShell({
  children,
  status,
}: {
  children: ReactNode;
  status?: string;
}) {
  return (
    <Card tone="dark" className="border-cyan-300/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Feedback</p>
          <h2 className="mt-2 text-2xl font-semibold">Tell the launch team what broke or felt risky.</h2>
        </div>
        {status ? <StatusBadge status={status}>{status}</StatusBadge> : null}
      </div>
      <div className="mt-5 grid gap-4">{children}</div>
    </Card>
  );
}

export function AdminReadinessPanel({
  decision,
  ready,
  checks,
}: {
  decision: "pass" | "warn" | "fail";
  ready: boolean;
  checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }>;
}) {
  return (
    <Card tone="dark" className="border-cyan-300/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Admin Launch Readiness</p>
          <h2 className="mt-2 text-2xl font-semibold">Gate decision: {decision}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Pass, warn, and fail checks stay visible so operators can make a recorded go/no-go decision.
          </p>
        </div>
        <StatusBadge status={ready ? "pass" : decision}>{ready ? "pass" : decision}</StatusBadge>
      </div>
      <div className="mt-5 grid gap-3">
        {checks.map((check) => (
          <div className="rounded-[18px] border border-white/10 bg-[#05070A] p-4" key={check.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{check.label}</div>
                <p className="mt-1 text-sm leading-6 text-slate-300">{check.detail}</p>
              </div>
              <StatusBadge status={check.status}>{check.status}</StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
