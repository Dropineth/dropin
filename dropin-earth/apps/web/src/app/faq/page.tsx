import Link from "next/link";
import { Card } from "@dropin/ui";

const faqs = [
  {
    question: "What is Dropin Earth?",
    answer: "Dropin Earth is a testnet climate action interface that connects Tree Lotto participation, project evidence, Impact Certificates, challenges, and public reporting.",
  },
  {
    question: "What is Tree Lotto?",
    answer: "Tree Lotto is a testnet participation flow where users rehearse Plant & Enter through Payment Intents and track proof objects. It is not a casino interface and does not add mainnet payment rails in this launch package.",
  },
  {
    question: "Is this real money?",
    answer: "No. The Great Green Wall campaign package is testnet-only. It does not request mainnet funds and does not execute live mainnet transfers.",
  },
  {
    question: "Are Leaf Points tokens?",
    answer: "No. Leaf Points are non-transferable testnet points only. They are not $CANOPY and are not automatically distributed as a token.",
  },
  {
    question: "Is Impact Certificate a carbon credit?",
    answer: "No. An Impact Certificate is not a certified carbon credit. It is a proof record for reviewed impact evidence.",
  },
  {
    question: "Is RWA Fragment guaranteed yield?",
    answer: "No. RWA Fragment is not guaranteed yield. Yield-bearing RWA mechanics are not part of this public testnet package.",
  },
  {
    question: "Does $CANOPY offset carbon tax?",
    answer: "No. $CANOPY does not offset carbon tax. Any future compliance service would require jurisdiction-specific rules, eligible credits, and proper retirement or surrender workflows.",
  },
  {
    question: "What is TON testnet?",
    answer: "TON testnet is a non-mainnet environment used to rehearse payment verification instructions. It should not be treated as a live mainnet payment rail.",
  },
  {
    question: "How do I report a bug?",
    answer: "Use the feedback page or the Mini App feedback CTA. Feedback becomes an operational item that admins can resolve with an audit trail.",
  },
  {
    question: "How do I submit a red-team challenge?",
    answer: "Open the red-team guide, choose a challenge target, attach evidence, and submit through the Challenge Board.",
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Public Testnet FAQ</p>
          <h1 className="mt-3 text-5xl font-semibold">Clear boundaries for external testers.</h1>
          <p className="mt-5 max-w-3xl leading-7 text-slate-300">
            The Great Green Wall Testnet Campaign is testnet-only. No mainnet funds, no automatic $CANOPY distribution,
            no certified carbon credit claims, no guaranteed yield, and no carbon tax offset claims.
          </p>
        </section>
        <section className="mt-8 grid gap-4">
          {faqs.map((faq) => (
            <Card key={faq.question} tone="dark">
              <h2 className="text-2xl font-semibold">{faq.question}</h2>
              <p className="mt-3 leading-7 text-slate-300">{faq.answer}</p>
            </Card>
          ))}
        </section>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950" href="/feedback">
            Report a bug
          </Link>
          <Link className="border border-white/15 px-5 py-3 text-sm font-semibold text-white" href="/red-team">
            Red-team challenge guide
          </Link>
        </div>
      </div>
    </main>
  );
}
