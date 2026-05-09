import Link from "next/link";
import { AllocationBreakdown, Card, ClimateDrawPass, HeroEarthOrb, ImpactTickerStrip, SafetyNotice, StatusBadge } from "@dropin/ui";
import { getApi } from "@/lib/api";

type CampaignDetail = {
  campaign: {
    id: string;
    title: string;
    slug: string;
    regionId: string;
    status: string;
    fundingGoalAmount: string;
    fundingGoalCurrency: string;
    treeGoal: number;
    roundId?: string;
    projectId?: string;
  };
  participantCount: number;
  leaderboard: Array<{ rank: number; userId: string; leafPoints: number }>;
};

type CampaignReport = {
  participantCount: number;
  ticketCount: number;
  confirmedPaymentIntentCount: number;
  totalConfirmedPaymentAmount: string;
  fundingGoalAmount: string;
  fundingGoalCurrency: string;
  treeGoal: number;
  evidenceCount: number;
  challengeCount: number;
  riskEventCount: number;
  impactCertificateStatuses: Record<string, number>;
  leaderboard: Array<{ rank: number; userId: string; leafPoints: number }>;
};

type ReadinessReport = {
  ready: boolean;
  decision: "pass" | "warn" | "fail";
  checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }>;
};

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const [detail, report, readiness] = await Promise.all([
    getApi<CampaignDetail>(`/campaigns/${campaignId}`),
    getApi<CampaignReport>(`/campaigns/${campaignId}/report`),
    getApi<ReadinessReport>(`/ready?campaignId=${campaignId}`),
  ]);
  const { campaign } = detail;
  const fundingProgress = Number(report.fundingGoalAmount) > 0
    ? Math.min(100, Math.round((Number(report.totalConfirmedPaymentAmount) / Number(report.fundingGoalAmount)) * 100))
    : 0;

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/campaigns">
            Campaigns
          </Link>
          <div className="flex flex-wrap gap-3 text-sm text-sky-200">
            {campaign.roundId ? <Link href={`/lottery/${campaign.roundId}`}>Active round</Link> : null}
            {campaign.projectId ? <Link href={`/projects/${campaign.projectId}`}>Project</Link> : null}
          </div>
        </div>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="flex flex-wrap gap-3">
              <StatusBadge status="testnet">Testnet only</StatusBadge>
              <StatusBadge status={campaign.status}>{campaign.status}</StatusBadge>
            </div>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">External Testnet Campaign</p>
            <h1 className="mt-3 text-5xl font-semibold">Dropin Earth Great Green Wall Testnet Campaign</h1>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">
              Plant through proof, not promises. This campaign packages the existing Dropin Earth testnet loop for
              external users: region discovery, Payment Intent rehearsal, Plant & Enter, Co-Plant sharing, proof tracking,
              feedback, and red-team challenge.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {campaign.roundId ? (
                <Link className="bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950" href={`/lottery/${campaign.roundId}`}>
                  Plant & Enter
                </Link>
              ) : null}
              <Link className="border border-white/15 px-5 py-3 text-sm font-semibold text-white" href="/red-team">
                Submit a challenge
              </Link>
              <Link className="border border-white/15 px-5 py-3 text-sm font-semibold text-white" href="/feedback">
                Send feedback
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            <HeroEarthOrb compact label="Great Green Wall campaign proof orb" />
            <ClimateDrawPass
              participants={detail.participantCount}
              poolSize={`${report.totalConfirmedPaymentAmount} ${campaign.fundingGoalCurrency}`}
              proofStatus={readiness.decision}
              region="Great Green Wall / Sahel"
              ticketPrice="1 TON / USDC Join Draw"
              title="Great Green Wall Climate Draw"
            />
            <AllocationBreakdown compact title="Campaign pool economics" />
          </div>
        </section>

        <section className="pb-6">
          <ImpactTickerStrip
            items={[
              { label: "Winner Allocation", value: "70%", status: "open" },
              { label: "Verified Reforestation", value: "20%", status: "proof" },
              { label: "Dropin Operations", value: "10%" },
              { label: "Proof Status", value: readiness.decision, status: readiness.decision },
            ]}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card tone="dark">
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric label="Status" value={campaign.status} />
              <Metric label="Participants" value={String(detail.participantCount)} />
              <Metric label="Tree goal" value={campaign.treeGoal.toLocaleString()} />
              <Metric label="Funding" value={`${report.totalConfirmedPaymentAmount} / ${campaign.fundingGoalAmount} ${campaign.fundingGoalCurrency}`} />
            </div>
            <div className="mt-6 h-2 border border-white/10 bg-white/5">
              <div className="h-full bg-emerald-400" style={{ width: `${fundingProgress}%` }} />
            </div>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Mission</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              The campaign tests whether a climate action loop can connect a Tree Lotto round, a planting project,
              reviewed evidence, Impact Certificates, challenge handling, and a public report without asking users to
              trust a vague promise.
            </p>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">How It Works</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "Join campaign",
                "Create Payment Intent",
                "Plant & Enter",
                "Earn Leaf Points",
                "Share Co-Plant invite",
                "Track proof",
              ].map((step, index) => (
                <div className="border border-white/10 bg-[#05070A] p-3" key={step}>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Step {index + 1}</div>
                  <div className="mt-1 font-semibold">{step}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Safety Notices</h2>
            <div className="mt-5 grid gap-3">
              {[
                "Testnet only. This public campaign does not execute mainnet payment rails.",
                "No mainnet funds are requested or transferred by this campaign package.",
                "Leaf Points are non-transferable testnet points only.",
                "An Impact Certificate is not a certified carbon credit.",
                "An RWA Fragment is not guaranteed yield.",
                "$CANOPY does not offset carbon tax.",
              ].map((notice) => (
                <SafetyNotice key={notice}>
                  {notice}
                </SafetyNotice>
              ))}
            </div>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Readiness Status</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Metric label="Ready" value={readiness.ready ? "yes" : "no"} />
              <Metric label="Launch gate" value={readiness.decision} />
            </div>
            <div className="mt-5 grid gap-2">
              {readiness.checks.slice(0, 6).map((check) => (
                <div className="flex items-center justify-between gap-4 border border-white/10 bg-[#05070A] p-3 text-sm" key={check.id}>
                  <span>{check.label}</span>
                  <strong className={check.status === "pass" ? "text-emerald-300" : check.status === "warn" ? "text-amber-200" : "text-red-300"}>
                    {check.status}
                  </strong>
                </div>
              ))}
            </div>
            <Link className="mt-5 inline-flex text-sm font-semibold text-cyan-200" href="/status">
              Open public status
            </Link>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Public Report Preview</h2>
            <div className="mt-5 grid gap-4">
              <Metric label="Tickets" value={String(report.ticketCount)} />
              <Metric label="Confirmed intents" value={String(report.confirmedPaymentIntentCount)} />
              <Metric label="Evidence objects" value={String(report.evidenceCount)} />
              <Metric label="Challenges" value={String(report.challengeCount)} />
              <Metric label="Risk events" value={String(report.riskEventCount)} />
            </div>
          </Card>

          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Leaderboard Preview</h2>
            <div className="mt-5 grid gap-3">
              {(report.leaderboard.length ? report.leaderboard : detail.leaderboard).slice(0, 8).map((entry) => (
                <div className="flex items-center justify-between border border-white/10 bg-[#05070A] p-3" key={`${entry.rank}:${entry.userId}`}>
                  <span>#{entry.rank} {entry.userId}</span>
                  <strong>{entry.leafPoints} LP</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Impact Proof</h2>
            <div className="mt-5 grid gap-4">
              {Object.entries(report.impactCertificateStatuses).map(([status, count]) => (
                <Metric key={status} label={status} value={String(count)} />
              ))}
              <p className="text-sm leading-6 text-slate-300">
                This campaign can reference Impact Certificates only. An Impact Certificate is not a certified carbon credit.
              </p>
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">FAQ</h2>
            <div className="mt-5 grid gap-4">
              <Faq question="Is this real money?" answer="No. This launch package is testnet-only and does not add mainnet payment rails." />
              <Faq question="Are Leaf Points tokens?" answer="No. Leaf Points are non-transferable testnet points only." />
              <Faq question="Is this a carbon credit?" answer="No. Impact Certificates are proof records, not certified carbon credits." />
              <Faq question="Can RWA Fragment drops guarantee yield?" answer="No. RWA Fragment is not guaranteed yield." />
            </div>
            <Link className="mt-5 inline-flex text-sm font-semibold text-cyan-200" href="/faq">
              Read full FAQ
            </Link>
          </Card>
          <Card tone="dark">
            <h2 className="text-2xl font-semibold">Red-Team Challenge</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Every claim can be challenged before it becomes trusted infrastructure. Challenge a round, payment intent,
              evidence object, Impact Certificate, fund allocation, or public campaign claim.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950" href="/red-team">
                Challenge guide
              </Link>
              <Link className="border border-white/15 px-4 py-3 text-sm font-semibold text-white" href="/challenges">
                Challenge board
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Faq({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border border-white/10 bg-[#05070A] p-4">
      <h3 className="font-semibold">{question}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{answer}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-xl font-semibold">{value}</div>
    </div>
  );
}
