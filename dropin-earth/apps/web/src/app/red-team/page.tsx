import Link from "next/link";
import { Card } from "@dropin/ui";

export default function RedTeamPage() {
  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-200">Red-Team Challenge Guide</p>
          <h1 className="mt-3 text-5xl font-semibold">Challenge before trust.</h1>
          <p className="mt-5 max-w-3xl leading-7 text-slate-300">
            Dropin Earth treats public claims as challengeable objects. Testnet recognition uses placeholder Leaf Points
            only; there is no automatic $CANOPY distribution, no guaranteed yield, and no carbon tax offset claim.
          </p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <GuideCard
            title="What can be challenged"
            items={[
              "Lottery round or randomness certificate",
              "Payment Intent or reconciliation anomaly",
              "Evidence object or Impact Certificate",
              "Fund allocation or settlement certificate",
              "Round anchor or impact anchor",
            ]}
          />
          <GuideCard
            title="Evidence examples"
            items={[
              "Duplicate transaction hash",
              "Wrong recipient, amount, memo, or network",
              "Repeated photo, GPS mismatch, or suspicious evidence",
              "Misleading carbon credit or yield wording",
              "Broken public report or readiness mismatch",
            ]}
          />
          <GuideCard
            title="How to submit"
            items={[
              "Open the Challenge Board",
              "Choose the target type and target ID",
              "Describe the exploit or misleading claim",
              "Attach evidence hash or public URI",
              "Track admin/red-team resolution",
            ]}
          />
          <GuideCard
            title="What happens after"
            items={[
              "Challenge enters review",
              "Evidence is attached to the case",
              "Accepted cases mark targets challenged",
              "Resolution is audit logged",
              "A protocol fix can be documented",
            ]}
          />
        </section>

        <Card tone="dark">
          <h2 className="text-2xl font-semibold">Recognition</h2>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Valid testnet challenges may receive non-transferable Leaf Points as placeholder recognition. Leaf Points are
            not tokens, not yield, and not $CANOPY.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="bg-red-300 px-5 py-3 text-sm font-semibold text-slate-950" href="/challenges">
              Open Challenge Board
            </Link>
            <Link className="border border-white/15 px-5 py-3 text-sm font-semibold text-white" href="/feedback">
              Send Feedback
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

function GuideCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card tone="dark">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li className="border border-white/10 bg-[#05070A] p-3" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
