import Link from "next/link";
import { ShareCardClient } from "./share-card-client";

export default async function ShareTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ roundId?: string | string[] | undefined }>;
}) {
  const { ticketId } = await params;
  const query = await searchParams;
  const roundId = (Array.isArray(query.roundId) ? query.roundId[0] : query.roundId) ?? "round_v1_ggw_demo";

  return (
    <main className="mini-shell">
      <Link style={{ color: "#00E5FF", fontSize: 13, fontWeight: 800 }} href="/me/forest">
        My Forest
      </Link>
      <section style={{ marginTop: 18 }}>
        <p className="mini-kicker">Co-Plant Invite</p>
        <h1 style={{ fontSize: 32, lineHeight: 1.05, margin: "8px 0" }}>My tree is waiting for proof.</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>
          Share this Ticket Seed as a Climate Proof Card. Referrals are risk-scored before
          becoming trusted growth signals.
        </p>
      </section>
      <ShareCardClient roundId={roundId} ticketId={ticketId} />
    </main>
  );
}
