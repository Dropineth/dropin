import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type Certificate = {
  id: string;
  projectId: string;
  treeClusterId: string;
  evidenceRoot: string;
  methodologyVersion: string;
  verifiedTreeCount: number;
  survivalRateEstimate: number;
  estimatedCo2eLow: string;
  estimatedCo2eHigh: string;
  status: string;
  claimBoundary: string;
};

export default async function AdminCertificatesPage() {
  const certificates = await getApi<Certificate[]>("/impact-certificates");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Impact Certificate Queue</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Inspect issued certificates, challenge state, methodology version, and evidence roots.
          These records are not certified carbon credits.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {certificates.map((certificate) => (
            <Card key={certificate.id} tone="dark">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, overflowWrap: "anywhere" }}>{certificate.id}</h2>
                  <p style={{ color: "#AFC2D1", lineHeight: 1.6 }}>
                    {certificate.projectId} / {certificate.treeClusterId}
                  </p>
                </div>
                <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                  {certificate.status}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 18 }}>
                <Metric label="Verified trees" value={certificate.verifiedTreeCount.toLocaleString()} />
                <Metric label="Survival estimate" value={`${Math.round(certificate.survivalRateEstimate * 100)}%`} />
                <Metric label="Estimated impact" value={`${certificate.estimatedCo2eLow} - ${certificate.estimatedCo2eHigh} tCO2e`} />
                <Metric label="Methodology" value={certificate.methodologyVersion} />
              </div>
              <div style={{ marginTop: 16, overflowWrap: "anywhere", color: "#AFC2D1", fontSize: 13 }}>
                Evidence root: {certificate.evidenceRoot}
              </div>
              <p style={{ marginTop: 12, color: "#F2DCA0", fontSize: 13 }}>{certificate.claimBoundary}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#7E91A2", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
