import Link from "next/link";
import { Card } from "@dropin/ui";
import { getApi } from "../../lib/api";

type Project = {
  id: string;
  title: string;
  regionId: string;
  operator: string;
  targetTreeCount: number;
  targetSpecies: string[];
  budgetAmount: string;
  status: string;
};

export default async function AdminProjectsPage() {
  const projects = await getApi<Project[]>("/projects");

  return (
    <main style={{ minHeight: "100vh", padding: 32 }}>
      <section style={{ margin: "0 auto", maxWidth: 1120 }}>
        <Link href="/" style={{ color: "#00E5FF", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Climate Operations Center
        </Link>
        <h1 style={{ margin: "18px 0 8px", fontSize: 44, lineHeight: 1.08 }}>Project Review Queue</h1>
        <p style={{ color: "#AFC2D1", lineHeight: 1.7, maxWidth: 760 }}>
          Track project status, target trees, budget, and operator ownership before milestone releases.
          Impact proof remains separate from certified carbon credit claims.
        </p>
        <div style={{ display: "grid", gap: 16, marginTop: 28 }}>
          {projects.map((project) => (
            <Card key={project.id} tone="dark">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 24 }}>{project.title}</h2>
                  <p style={{ color: "#AFC2D1", lineHeight: 1.6 }}>{project.operator}</p>
                </div>
                <span style={{ border: "1px solid rgb(255 255 255 / 15%)", padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                  {project.status}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 18 }}>
                <Metric label="Region" value={project.regionId} />
                <Metric label="Target" value={`${project.targetTreeCount.toLocaleString()} trees`} />
                <Metric label="Budget" value={`$${project.budgetAmount}`} />
                <Metric label="Species" value={project.targetSpecies.join(", ")} />
              </div>
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
