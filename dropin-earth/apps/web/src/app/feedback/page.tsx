import Link from "next/link";
import { FeedbackForm } from "./feedback-form";

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href="/">
          Dropin Earth
        </Link>
        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Public Testnet</p>
          <h1 className="mt-3 text-5xl font-semibold">Feedback</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Report launch friction, confusing claims, payment issues, suspicious behavior, or proof gaps. Feedback is
            tracked as an operational object and can be resolved with an audit trail.
          </p>
        </section>
        <section className="mt-8">
          <FeedbackForm />
        </section>
      </div>
    </main>
  );
}
