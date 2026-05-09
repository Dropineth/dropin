import {
  AllocationBreakdown,
  AppShell,
  ButtonLink,
  ClimateDrawPass,
  DrawCountdown,
  DrawProgress,
  ImpactMetricCard,
  ParticipationHistory,
  ParticipantAvatars,
  ProofTimeline,
  SafetyNotice,
  StatusBadge,
  TicketCard,
  WinnerResultCard,
} from "@dropin/ui";
import { getApi } from "@/lib/api";
import { LotteryEntryPanel } from "./lottery-entry-panel";

type RoundDetail = {
  round: {
    id: string;
    title: string;
    regionId: string;
    status: string;
    ticketPriceAmount: string;
    ticketPriceSymbol: string;
    opensAt: string;
    closesAt: string;
    entryMerkleRoot?: string;
    entryCount: number;
    totalAmount: string;
  };
  entries: Array<{ id: string; wallet: string; userId: string }>;
  tickets: Array<{ id: string; ticketNumber: number; receiptHash?: string }>;
};

type RoundResults = {
  proof: {
    entryMerkleRoot?: string;
    randomnessCertificateId?: string;
    finalSeed?: string;
    winnerMerkleRoot?: string;
    dropMerkleRoot?: string;
    scriptHash?: string;
  };
  winners: Array<{ id: string; wallet: string; prizeAmount: string; prizeCurrency: string; rank: number }>;
  drops: Array<{
    id: string;
    wallet: string;
    userId: string;
    canopyAmount: string;
    rwaFragmentAmount: string;
    rarity: string;
  }>;
  rwaFragments: Array<{
    id: string;
    holderWallet: string;
    notionalCo2e?: string;
    status: string;
    disclosure: string;
  }>;
};

export default async function LotteryRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const detail = await getApi<RoundDetail>(`/lottery/rounds/${roundId}`);
  const results = await getApi<RoundResults>(`/lottery/rounds/${roundId}/results`);
  const round = detail.round;
  const isFinalized = round.status === "finalized";
  const poolSize = `${round.totalAmount} ${round.ticketPriceSymbol}`;
  const winnerCount = results.winners.length;
  const dropTotal = results.drops.reduce((sum, drop) => sum + Number(drop.canopyAmount), 0);
  const ticket = detail.tickets[0];

  const drawSteps = [
    { label: "Entries frozen", status: round.entryMerkleRoot ? "complete" : round.status === "closed" ? "current" : "pending" },
    { label: "Randomness certificate generated", status: results.proof.randomnessCertificateId ? "complete" : round.entryMerkleRoot ? "current" : "pending" },
    { label: "Winners computed", status: results.proof.winnerMerkleRoot ? "complete" : results.proof.randomnessCertificateId ? "current" : "pending" },
    { label: "Drop roots computed", status: results.proof.dropMerkleRoot ? "complete" : results.proof.winnerMerkleRoot ? "current" : "pending" },
    { label: "Fund allocation created", status: isFinalized ? "complete" : results.proof.dropMerkleRoot ? "current" : "pending" },
    { label: "Proof anchor pending/complete", status: isFinalized ? "current" : "pending" },
  ] as const;

  return (
    <AppShell
      nav={
        <>
          <a href="/campaigns/campaign_v1_ggw_testnet">Campaign</a>
          <a href="/fund">Fund</a>
          <a href="/challenges">Challenges</a>
          <a href="/status">Status</a>
        </>
      }
    >
      <section className="grid gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={round.status}>{round.status}</StatusBadge>
            <StatusBadge status="testnet">Testnet only</StatusBadge>
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
            Active Draw / Pre-draw
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight text-white">
            {round.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Join a premium climate-impact prize pool. The public pool view always shows
            70% Winner, 20% Verified Reforestation, and 10% Dropin Operations with proof
            roots, payment intent rules, and challenge status visible.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="#plant-enter">Plant & Enter</ButtonLink>
            <ButtonLink href="#impact-proof" variant="secondary">
              View Impact Proof
            </ButtonLink>
          </div>
        </div>
        <ClimateDrawPass
          participants={round.entryCount}
          poolSize={poolSize}
          proofStatus={round.status}
          region={round.regionId}
          ticketPrice={`${round.ticketPriceAmount} ${round.ticketPriceSymbol} Join Draw`}
          title={round.title}
        />
      </section>

      <section className="grid gap-4 pb-8 md:grid-cols-4">
        <ImpactMetricCard label="Current pool size" value={poolSize} detail="Confirmed testnet entries only" status={round.status} />
        <ImpactMetricCard label="Winner Allocation" value="70%" detail="Prize result is deterministic after finalization" />
        <ImpactMetricCard label="Verified Reforestation" value="20%" detail="Tree Fund links to project milestones" />
        <ImpactMetricCard label="Proof / Transparency" value={round.entryMerkleRoot ? "Rooted" : "Pending"} detail="Challengeable before trust is finalized" />
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-[0.85fr_1.15fr]">
        <AllocationBreakdown title="Prize-pool economics" />
        <div className="grid gap-4">
          <DrawCountdown closesAt={round.closesAt} />
          <SafetyNotice tone="proof">
            Payment Intent, ticket seed, entry root, randomness certificate, winner root, drop root,
            and Tree Fund allocation remain visible before the draw becomes trusted.
          </SafetyNotice>
          <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4">
            <ParticipantAvatars count={round.entryCount} label="participants in this pool" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-[0.9fr_1.1fr]" id="plant-enter">
        <LotteryEntryPanel roundId={round.id} regionId={round.regionId} />
        <DrawProgress steps={drawSteps} />
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-[1.1fr_0.9fr]">
        <WinnerResultCard
          impact={isFinalized ? "20% allocated" : "Pending close"}
          leafPoints={isFinalized ? "+10 LP" : "Pending"}
          prize={winnerCount > 0 ? `${winnerCount} winner result${winnerCount === 1 ? "" : "s"}` : "Not this round"}
          won={winnerCount > 0}
        />
        <TicketCard
          receiptHash={ticket?.receiptHash ?? "Ticket Seed appears after Plant & Enter succeeds."}
          status={ticket ? "entered" : round.status}
          ticketNumber={ticket ? `#${ticket.ticketNumber}` : "Not entered"}
        />
      </section>

      <section className="grid gap-6 pb-8 lg:grid-cols-[0.9fr_1.1fr]">
        <ParticipationHistory
          items={[
            {
              detail: `${round.entryCount} public entries / ${dropTotal} $CANOPY testnet drop units computed`,
              href: `/lottery/${round.id}`,
              status: isFinalized ? "finalized" : "entered",
              title: round.title,
            },
            {
              detail: "20% verified reforestation allocation connects this draw to the Tree Fund ledger.",
              href: "/fund",
              status: isFinalized ? "impact allocated" : "pending",
              title: "Tree Fund allocation",
            },
            {
              detail: "Solana anchor and challenge path make the proof layer reviewable.",
              href: "/challenges",
              status: isFinalized ? "proof anchored" : "pending",
              title: "CanopyProof review",
            },
          ]}
        />
        <ProofTimeline
          disclaimer="Impact Certificate is not a certified carbon credit."
          items={[
            { label: "Entry root", value: round.entryMerkleRoot ?? "Waiting for close", status: round.entryMerkleRoot ? "complete" : "pending" },
            { label: "Randomness certificate", value: results.proof.randomnessCertificateId ?? "Pending", status: results.proof.randomnessCertificateId ? "complete" : "pending" },
            { label: "Winner root", value: results.proof.winnerMerkleRoot ?? "Pending", status: results.proof.winnerMerkleRoot ? "complete" : "pending" },
            { label: "Drop root", value: results.proof.dropMerkleRoot ?? "Pending", status: results.proof.dropMerkleRoot ? "complete" : "pending" },
            { label: "Script hash", value: results.proof.scriptHash ?? "Pending", status: results.proof.scriptHash ? "complete" : "pending" },
          ]}
        />
      </section>

      <section className="grid gap-6 pb-16 lg:grid-cols-3" id="impact-proof">
        <ImpactMetricCard label="RWA Fragment Boundary" value="No guaranteed yield" detail="Fragments are restricted testnet utility placeholders in this launch." status="warn" />
        <ImpactMetricCard label="$CANOPY Boundary" value="No tax offset" detail="$CANOPY does not offset carbon tax." status="warn" />
        <ImpactMetricCard label="Safety Boundary" value="Testnet only" detail="No mainnet payment rail or private-key collection." status="ready" />
      </section>
    </AppShell>
  );
}
