import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type EvidenceObject = {
  id: string;
  projectId: string;
  treeClusterId?: string;
  kind: string;
  uri: string;
  sha256Hash: string;
  submittedBy: string;
  status: string;
  createdAt: string;
};

export default async function AdminEvidencePage() {
  const evidence = await getApi<EvidenceObject[]>("/evidence");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Evidence Review Queue</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Review hashed field proof before it can support an Impact Certificate. A single accepted
          object is only a minimum gate; operational policy should still require multi-source proof.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {evidence.map((item) => (
            <Card key={item.id} tone="dark">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>{item.kind} evidence</h2>
                  <p style={{ color: "#AFC2D1", lineHeight: 1.6 }}>
                    {item.projectId} {item.treeClusterId ? `/ ${item.treeClusterId}` : ""}
                  </p>
                </div>
                <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                  {item.status}
                </span>
              </div>
              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                <Field label="URI" value={item.uri} />
                <Field label="SHA-256" value={item.sha256Hash} />
                <Field label="Submitted by" value={item.submittedBy} />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 5, overflowWrap: "anywhere", fontSize: 14, color: "#F5F7FA" }}>{value}</div>
    </div>
  );
}
