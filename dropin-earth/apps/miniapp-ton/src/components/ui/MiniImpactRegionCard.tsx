import type { Region } from "@dropin/schemas";

export function MiniImpactRegionCard({ region }: { region: Pick<Region, "name" | "restorationPriority" | "verifiedTrees" | "estimatedCo2eTonnes" | "survivalRateEstimate"> }) {
  return (
    <section className="mini-card" style={{ display: "grid", gap: 12, marginTop: 14 }}>
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="mini-kicker" style={{ margin: 0 }}>Area Selection</p>
          <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>{region.name}</h2>
        </div>
        <span style={{ border: "1px solid rgb(83 245 255 / 28%)", borderRadius: 999, color: "#B9FBFF", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", padding: "6px 8px", textTransform: "uppercase" }}>
          {region.restorationPriority}
        </span>
      </div>
      <div aria-label="Mini 3D Earth orb region selector" style={{ aspectRatio: "1 / 1", background: "radial-gradient(circle at 38% 42%, rgba(0,200,83,0.88), transparent 0 15%, transparent 28%), radial-gradient(circle at 64% 58%, rgba(212,175,55,0.68), transparent 0 10%, transparent 22%), radial-gradient(circle at 50% 50%, #1E88E5, #0A3552 62%, #04111B 74%)", border: "1px solid rgb(83 245 255 / 18%)", borderRadius: "50%", boxShadow: "0 0 60px rgb(30 136 229 / 36%)", margin: "0 auto", maxWidth: 220, width: "100%" }} />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div className="mini-label">Verified Trees</div>
          <strong>{region.verifiedTrees.toLocaleString()}</strong>
        </div>
        <div>
          <div className="mini-label">CO2 Estimated</div>
          <strong>{region.estimatedCo2eTonnes.toLocaleString()} t</strong>
        </div>
        <div>
          <div className="mini-label">Survival</div>
          <strong>{Math.round(region.survivalRateEstimate * 100)}%</strong>
        </div>
        <div>
          <div className="mini-label">Carbon Claim</div>
          <strong>Estimated</strong>
        </div>
      </div>
    </section>
  );
}
