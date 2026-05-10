import type { LeaderboardEntry } from "@dropin/schemas";

type LeaderboardCardProps = {
  entries: LeaderboardEntry[];
  title?: string;
};

export function LeaderboardCard({ entries, title = "Global / Regional Leaderboard" }: LeaderboardCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5 text-white shadow-[0_18px_70px_rgb(0_0_0/0.24)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Leaf Points</p>
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        </div>
        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">
          Non-transferable
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {entries.length ? (
          entries.slice(0, 8).map((entry) => (
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[18px] border border-white/10 bg-[#05070A]/78 p-3" key={`${entry.rank}:${entry.userId}`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-300 to-amber-200 text-sm font-black text-[#05070A]">
                {entry.rank}
              </span>
              <div>
                <div className="font-semibold">{entry.userId}</div>
                <div className="text-xs text-slate-400">Co-planting / challenge-safe contribution score</div>
              </div>
              <strong className="text-amber-100">{entry.leafPoints.toLocaleString()} LP</strong>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-white/10 bg-[#05070A]/78 p-4 text-sm text-slate-300">
            No Leaf Points yet. Join a campaign to appear on the leaderboard.
          </div>
        )}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-400">
        Leaf Points are non-transferable testnet points and cannot be sold as carbon offsets.
      </p>
    </article>
  );
}
