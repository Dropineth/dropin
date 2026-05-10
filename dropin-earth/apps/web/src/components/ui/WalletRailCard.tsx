type WalletRailCardProps = {
  rails: Array<{
    label: string;
    chain: "TON" | "Ethereum" | "Solana";
    status: "testnet" | "mock" | "disabled";
  }>;
};

export function WalletRailCard({ rails }: WalletRailCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5 text-white shadow-[0_18px_70px_rgb(0_0_0/0.24)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Wallet Connect Rails</p>
      <h2 className="mt-2 text-2xl font-semibold">TON / Ethereum / Solana ready, mainnet guarded</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        The UI exposes wallet rail readiness without enabling live mainnet payments. Payment Intent verification remains
        fail-closed and admin mutations stay outside public routes.
      </p>
      <div className="mt-5 grid gap-3">
        {rails.map((rail) => (
          <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-[#05070A]/78 p-4" key={`${rail.chain}:${rail.label}`}>
            <div>
              <div className="font-semibold">{rail.label}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{rail.chain}</div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${rail.status === "disabled" ? "border-red-200/30 bg-red-300/10 text-red-100" : rail.status === "testnet" ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-100" : "border-amber-200/30 bg-amber-300/10 text-amber-100"}`}>
              {rail.status}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
