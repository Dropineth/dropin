import Link from "next/link";
import { AppShell, SafetyNotice, StatusBadge } from "@dropin/ui";
import { FeedbackForm } from "./feedback-form";

export default function FeedbackPage() {
  return (
    <AppShell
      nav={
        <>
          <Link href="/status">Status</Link>
          <Link href="/red-team">Red Team</Link>
          <Link href="/campaigns/campaign_v1_ggw_testnet">Campaign</Link>
        </>
      }
    >
      <div className="mx-auto max-w-4xl py-10">
        <section>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="open">open queue</StatusBadge>
            <StatusBadge status="testnet">testnet only</StatusBadge>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Public Testnet</p>
          <h1 className="mt-3 text-5xl font-semibold">Feedback</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Report launch friction, confusing claims, payment issues, suspicious behavior, or proof gaps. Feedback is
            tracked as an operational object and can be resolved with an audit trail.
          </p>
          <div className="mt-5">
            <SafetyNotice tone="proof">
              Feedback is part of the trust layer: every bug report, payment concern, UI gap, proof concern,
              or risk signal can become an auditable launch item.
            </SafetyNotice>
          </div>
        </section>
        <section className="mt-8">
          <FeedbackForm />
        </section>
      </div>
    </AppShell>
  );
}
