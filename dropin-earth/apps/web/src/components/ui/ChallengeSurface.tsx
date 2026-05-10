type ChallengeSurfaceProps = {
  openChallengeCount: number;
  riskEventCount: number;
  challengeHref?: string;
};

export function ChallengeSurface({
  openChallengeCount,
  riskEventCount,
  challengeHref = "/challenges",
}: ChallengeSurfaceProps) {
  return (
    <article className="rounded-[24px] border border-red-300/18 bg-red-400/[0.06] p-5 text-white shadow-[0_18px_70px_rgb(0_0_0/0.24)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100">Red Team / Challenge</p>
          <h2 className="mt-2 text-2xl font-semibold">Every claim remains challengeable</h2>
        </div>
        <span className="rounded-full border border-red-200/30 bg-red-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-red-100">
          Fail-closed
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">
        Payment, randomness, evidence, Impact Certificate, fund allocation, and anchor claims can be challenged before
        they are treated as trusted environmental truth.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-white/10 bg-[#05070A]/78 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Open Challenges</div>
          <div className="mt-2 text-3xl font-semibold">{openChallengeCount}</div>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-[#05070A]/78 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Risk Events</div>
          <div className="mt-2 text-3xl font-semibold">{riskEventCount}</div>
        </div>
      </div>
      <a className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full border border-red-200/40 px-5 py-3 text-sm font-semibold text-red-50 transition hover:bg-red-300/10" href={challengeHref}>
        Open Challenge Board
      </a>
    </article>
  );
}
