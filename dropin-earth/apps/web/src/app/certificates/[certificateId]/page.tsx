import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "@/lib/api";

type Certificate = {
  id: string;
  projectId: string;
  treeClusterId: string;
  certificateLevel: string;
  evidenceRoot: string;
  methodologyVersion: string;
  verifiedTreeCount: number;
  survivalRateEstimate: number;
  estimatedCo2eLow: string;
  estimatedCo2eHigh: string;
  confidenceScore: number;
  status: string;
  certificateHash: string;
  claimBoundary: string;
};

export default async function CertificatePage({ params }: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await params;
  const certificate = await getApi<Certificate>(`/impact-certificates/${certificateId}`);

  return (
    <main className="min-h-screen bg-[#05070A] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300" href={`/projects/${certificate.projectId}`}>
          Project
        </Link>
        <section className="py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
            Impact Certificate
          </p>
          <h1 className="mt-3 break-all text-4xl font-semibold">{certificate.id}</h1>
          <p className="mt-5 rounded border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
            This is an Impact Certificate, not a certified carbon credit.
          </p>
          {certificate.status === "challenged" ? (
            <p className="mt-3 rounded border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100">
              This certificate is challenged. Treat all claims as pending review.
            </p>
          ) : null}
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Project ID", certificate.projectId],
            ["Tree Cluster", certificate.treeClusterId],
            ["Level", certificate.certificateLevel],
            ["Status", certificate.status],
            ["Verified trees", certificate.verifiedTreeCount.toLocaleString()],
            ["Survival estimate", `${Math.round(certificate.survivalRateEstimate * 100)}%`],
            ["Estimated CO2e", `${certificate.estimatedCo2eLow} - ${certificate.estimatedCo2eHigh}`],
            ["Methodology", certificate.methodologyVersion],
          ].map(([label, value]) => (
            <Card key={label} tone="dark">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</div>
              <div className="mt-2 break-all text-xl font-semibold">{value}</div>
            </Card>
          ))}
        </div>
        <Card className="mt-4" tone="dark">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Evidence Root</div>
          <div className="mt-2 break-all text-sm">{certificate.evidenceRoot}</div>
          <div className="mt-5 text-xs uppercase tracking-[0.12em] text-slate-400">Certificate Hash</div>
          <div className="mt-2 break-all text-sm">{certificate.certificateHash}</div>
          <p className="mt-5 text-sm leading-6 text-slate-300">{certificate.claimBoundary}</p>
        </Card>
      </div>
    </main>
  );
}
