import { AllocationBreakdown, AppShell, ButtonLink, Card, ProofTimeline, StatusBadge } from "@dropin/ui";

const steps = [
  "Join prize pool",
  "70% winner / 20% verified reforestation / 10% operations",
  "Tree fund supports verified projects",
  "Evidence and certificates are generated",
  "Claims can be challenged before trust is finalized",
];

const verificationFlow = ["Donation", "NGO", "Planting", "Satellite / Oracle", "On-chain proof"];

export default function AboutPage() {
  return (
    <AppShell
      nav={
        <>
          <a href="/lottery/round_v1_ggw_demo">Active Draw</a>
          <a href="/certificates/cert_v1_ggw_demo">Impact Proof</a>
          <a href="/red-team">Red Team</a>
        </>
      }
    >
      <section className="grid gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="testnet">Testnet only</StatusBadge>
            <StatusBadge status="ready">CanopyProof / 林证协议</StatusBadge>
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">About / How It Works</p>
          <h1 className="mt-3 text-5xl font-semibold leading-tight">Climate-impact pools with proof-first settlement.</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Dropin Earth lets users join climate-impact prize pools and track how each pool connects
            to verified reforestation, evidence, Impact Certificates, and challengeable proof roots.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/lottery/round_v1_ggw_demo">Join Active Draw</ButtonLink>
            <ButtonLink href="/red-team" variant="secondary">
              Challenge Guide
            </ButtonLink>
          </div>
        </div>
        <AllocationBreakdown title="Public pool economics" />
      </section>

      <section className="grid gap-4 pb-10 md:grid-cols-5">
        {steps.map((step, index) => (
          <Card key={step} tone="dark">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Step {index + 1}</div>
            <h2 className="mt-3 text-xl font-semibold">{step}</h2>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 pb-10 md:grid-cols-5">
        {verificationFlow.map((step, index) => (
          <Card key={step} tone="dark">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Verification {index + 1}</div>
            <h2 className="mt-3 text-xl font-semibold">{step}</h2>
          </Card>
        ))}
      </section>

      <section className="pb-16">
        <ProofTimeline
          disclaimer="Impact Certificate is not a certified carbon credit. RWA Fragment is not guaranteed yield. $CANOPY does not offset carbon tax."
          items={[
            { label: "CanopyProof / 林证协议", value: "CanopyProof is the proof layer for verified climate action.", status: "ready" },
            { label: "Payment boundary", value: "Public testnet uses Payment Intents and no mainnet payment rail.", status: "testnet" },
            { label: "Challenge boundary", value: "Every high-value claim can be challenged before trust is finalized.", status: "challengeable" },
          ]}
        />
      </section>
    </AppShell>
  );
}
