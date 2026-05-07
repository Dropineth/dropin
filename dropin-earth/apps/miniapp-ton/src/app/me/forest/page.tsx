import Link from "next/link";
import { getApi } from "@/lib/api";

type Forest = {
  tickets: Array<{ id: string; roundId: string; ticketNumber: number; receiptHash: string }>;
  drops: Array<{ id: string; canopyAmount: string; rarity: string; roundId: string }>;
  rwaFragments: Array<{ id: string; status: string; notionalCo2e?: string; disclosure?: string }>;
  impactCertificates: Array<{
    id: string;
    projectId: string;
    verifiedTreeCount: number;
    status: string;
    certificateLevel: string;
  }>;
  referralStats: {
    claimed: number;
    suspicious: number;
    leafPoints: number;
  };
  disclaimer: string;
};

export default async function MiniForestPage() {
  const forest = await getApi<Forest>("/telegram/forest?userId=demo-user");

  return (
    <main className="mini-shell">
      <Link style={{ color: "#00E5FF", fontSize: 13, fontWeight: 800 }} href="/">
        Dropin Earth
      </Link>
      <section style={{ marginTop: 18 }}>
        <p className="mini-kicker">My Forest</p>
        <h1 style={{ fontSize: 32, lineHeight: 1.05, margin: "8px 0" }}>Ticket Seeds, drops, proofs.</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.55, margin: 0 }}>{forest.disclaimer}</p>
      </section>

      <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Referral Stats</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Metric label="Co-plants" value={String(forest.referralStats.claimed)} />
          <Metric label="Review" value={String(forest.referralStats.suspicious)} />
          <Metric label="Leaf Points" value={String(forest.referralStats.leafPoints)} />
        </div>
      </section>

      <ListSection
        empty="No Ticket Seeds yet."
        items={forest.tickets.map((ticket) => ({
          href: `/share/${ticket.id}?roundId=${ticket.roundId}`,
          label: `Ticket Seed #${ticket.ticketNumber}`,
          value: ticket.receiptHash,
        }))}
        title="Tickets"
      />
      <ListSection
        empty="No $CANOPY drops yet."
        items={forest.drops.map((drop) => ({
          label: `${drop.rarity} drop`,
          value: `${drop.canopyAmount} $CANOPY`,
        }))}
        title="$CANOPY Drops"
      />
      <ListSection
        empty="No RWA fragments yet."
        items={forest.rwaFragments.map((fragment) => ({
          label: fragment.status,
          value: fragment.notionalCo2e ? `${fragment.notionalCo2e} tCO2e future impact right` : "utility fragment",
        }))}
        title="RWA Fragments"
      />
      <ListSection
        empty="No Impact Certificates yet."
        items={forest.impactCertificates.map((certificate) => ({
          label: certificate.id,
          value: `${certificate.verifiedTreeCount} verified trees / ${certificate.status}`,
        }))}
        title="Impact Certificates"
      />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mini-label">{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function ListSection({
  empty,
  items,
  title,
}: {
  empty: string;
  items: Array<{ href?: string; label: string; value: string }>;
  title: string;
}) {
  return (
    <section className="mini-card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
      {items.length === 0 ? <p style={{ color: "#8094A5", margin: 0 }}>{empty}</p> : null}
      {items.map((item) => {
        const body = (
          <div className="mini-row">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        );
        return item.href ? (
          <Link href={item.href} key={`${item.label}:${item.value}`}>
            {body}
          </Link>
        ) : (
          <div key={`${item.label}:${item.value}`}>{body}</div>
        );
      })}
    </section>
  );
}
