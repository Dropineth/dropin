import type {
  CertificateCheckpoint,
  CertificateField,
  ExplorerMetric,
  IngestionStage,
  InstitutionalMetric,
  ProofRecord,
  RiskIndicator,
  StackLayer,
  StatusSignal,
  TelemetryLayer,
  TelemetryPoint,
  WorkflowStep,
} from "@/data/siteContent";
import {
  ecosystemNodes,
  explorerMetrics,
  fieldFeatures,
  infraStack,
  ingestionPipeline,
  institutionalMetrics,
  proofRecords,
  prototypeDemo,
  reportingOptions,
  riskIndicators,
  sampleCertificate,
  systemStatusSignals,
  telemetryLayers,
  transparencyBefore,
  verificationInputs,
  verificationOutputs,
  waterRestorationSeries,
  workflowSteps,
} from "@/data/siteContent";
import { SectionBoundary } from "@/components/system/SectionBoundary";
import { CanopyProofLogo } from "./CanopyProofLogo";
import { EarthOrb } from "./EarthOrb";
import { MetricsStripFallback, TelemetryFallback } from "./fallbacks";
import { GlassCard } from "./GlassCard";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CanopyProof",
  url: "https://canopyproof.org",
  parentOrganization: {
    "@type": "Organization",
    name: "Dropin",
  },
  description:
    "CanopyProof by Dropin is a deterministic environmental accountability routing protocol: it turns restoration evidence into transparent, verifiable proof records.",
  sameAs: ["https://canopyproof.org"],
};

export function CanopyProofLanding() {
  return (
    <main className="cp-site">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <HeroSection />
      <SectionBoundary label="metrics" fallback={<MetricsStripFallback />}>
        <InstitutionalMetricsStrip metrics={institutionalMetrics} />
      </SectionBoundary>
      <TransparencyGapSection stages={ingestionPipeline} />
      <FieldRealitySection />
      <SolutionSection steps={workflowSteps} />
      <MobileReportingShowcase />
      <VerificationPipeline />
      <ExplorerPreview metrics={explorerMetrics} records={proofRecords} />
      <ImpactCertificateSection />
      <SectionBoundary label="telemetry" fallback={<TelemetryFallback />}>
        <TerraProofTelemetry series={waterRestorationSeries} layers={telemetryLayers} risks={riskIndicators} />
      </SectionBoundary>
      <EcosystemNetwork />
      <InfraStackSection layers={infraStack} />
      <ClosingCTA />
      <Footer />
    </main>
  );
}

function Navbar() {
  const links = [
    { href: "#protocol", label: "Protocol" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#explorer", label: "Explorer" },
    { href: "#methodology", label: "Methodology" },
    { href: "#stack", label: "Open Stack" },
    { href: "#contact", label: "Contact" },
  ] as const;

  return (
    <header className="cp-nav">
      <a aria-label="CanopyProof home" className="cp-brand" href="#top">
        <CanopyProofLogo loading="eager" size={42} />
        <span>
          <strong className="tracking-tight">CanopyProof</strong>
          <small>by Dropin</small>
        </span>
      </a>
      <nav aria-label="CanopyProof sections" className="cp-nav-links">
        {links.map((link) => (
          <a href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <a className="cp-nav-cta" href="#explorer">
        Proof Explorer
      </a>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Module 1 — Hero + live system status terminal                       */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section className="cp-hero" id="top">
      <div className="cp-hero-copy">
        <p className="cp-eyebrow">CanopyProof by Dropin</p>
        <StatusTerminal signals={systemStatusSignals} />
        <h1 className="tracking-tight">Environmental accountability. Verified. Transparent. Restored.</h1>
        <p className="cp-lede">
          CanopyProof is an open environmental accountability routing protocol. It binds field evidence, satellite
          layers, community observation, and AI-assisted ecological review into a single verifiable proof system —
          transparent inputs, deterministic outputs, auditable records.
        </p>
        <div className="cp-hero-actions" aria-label="Primary actions">
          <a className="cp-button cp-button-primary" href="#explorer">
            Open the Proof Explorer
          </a>
          <a className="cp-button cp-button-secondary" href="#how-it-works">
            See How It Works
          </a>
          <a
            aria-label={prototypeDemo.externalLabel}
            className="cp-button cp-button-ghost"
            href={prototypeDemo.href}
            rel="noreferrer"
            target="_blank"
          >
            {prototypeDemo.label}
          </a>
        </div>
        <div className="cp-trust-row" aria-label="Safety boundaries">
          <span>Public-interest infrastructure</span>
          <span>Demo values clearly labeled</span>
          <span>No production claims implied</span>
        </div>
        <p className="mt-4 max-w-xl font-mono text-[11px] tracking-tight text-zinc-500">
          Prototype transparency: sample metrics and selected visual scenes
        </p>
      </div>
      <div className="cp-hero-visual">
        <EarthOrb />
        <GlassCard className="cp-hero-panel">
          <span className="cp-status-dot" />
          <div>
            <strong>Sample proof workflow</strong>
            <p className="font-mono text-[12px] tracking-tight">
              {"Reported -> Verified -> Recorded -> Monitored -> Impact Confirmed"}
            </p>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

function StatusTerminal({ signals }: { signals: StatusSignal[] }) {
  return (
    <div className="mb-7 w-full max-w-xl rounded-lg border border-zinc-800/70 bg-zinc-950/70 px-3 py-2 font-mono text-[11px] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
        <span className="flex items-center gap-2 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          system.status
        </span>
        <span className="text-zinc-500">interface preview</span>
      </div>
      <ul className="mt-2 grid gap-1.5">
        {signals.map((signal) => (
          <li className="flex items-center justify-between gap-4" key={signal.label}>
            <span className="text-zinc-500">{signal.label}</span>
            <span
              className={
                signal.tone === "ok"
                  ? "tracking-tight text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                  : "tracking-tight text-amber-400"
              }
            >
              {signal.state}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InstitutionalMetricsStrip({ metrics }: { metrics: InstitutionalMetric[] }) {
  return (
    <section className="cp-section" aria-label="Network metrics">
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">Network metrics</p>
          <p className="font-mono text-[11px] tracking-tight text-zinc-500">illustrative sample · not verified totals</p>
        </div>
        <dl className="grid divide-zinc-800/60 sm:grid-cols-3 sm:divide-x">
          {metrics.map((metric) => (
            <div className="px-6 py-8" key={metric.label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{metric.label}</dt>
              <dd className="mt-3 flex items-baseline gap-3">
                <span className="text-4xl font-semibold tracking-tight tabular-nums text-zinc-50">{metric.value}</span>
                <span className="font-mono text-[12px] tracking-tight text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.25)]">
                  {metric.delta}
                </span>
              </dd>
              <p className="mt-2 text-[13px] text-zinc-500">{metric.window}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Module 2 — The transparency gap (before chaos / after pipeline)     */
/* ------------------------------------------------------------------ */

function TransparencyGapSection({ stages }: { stages: IngestionStage[] }) {
  return (
    <section className="cp-section" id="protocol">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">The Transparency Gap</p>
        <h2 className="tracking-tight">Restoration is happening. Trust is fragmented.</h2>
        <p>
          Today, impact is scattered across paper records, spreadsheets, email threads, and unverifiable reports.
          CanopyProof routes that raw signal through a deterministic ingestion pipeline into one open, auditable ledger.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-zinc-300">Before · fragmented</h3>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-400/80">unverified</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3" aria-hidden="true">
            {transparencyBefore.map((item) => (
              <div
                className="rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/40 px-3 py-4 text-[13px] text-zinc-500"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950/40 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-zinc-100">After · routed proof</h3>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400/90">deterministic</span>
          </div>
          <ol className="mt-5 grid gap-2.5">
            {stages.map((stage, index) => (
              <li
                className="group flex items-start gap-4 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-4 py-3.5 transition-colors hover:border-emerald-500/40"
                key={stage.index}
              >
                <span className="mt-0.5 font-mono text-[12px] text-emerald-400/80 tabular-nums">{stage.index}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold tracking-tight text-zinc-100">{stage.title}</span>
                  <span className="mt-0.5 block text-[13px] text-zinc-500">{stage.detail}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 font-mono text-emerald-400/50 transition-colors group-hover:text-emerald-400"
                >
                  {index === stages.length - 1 ? "■" : "↓"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Retained narrative sections (field, solution, mobile, pipeline)     */
/* ------------------------------------------------------------------ */

function FieldRealitySection() {
  return (
    <section className="cp-section cp-field">
      <div className="cp-documentary-panel">
        <div className="cp-field-scene" aria-label="Illustration of field workers documenting restoration work">
          <span className="terrain hill-one" />
          <span className="terrain hill-two" />
          <span className="river" />
          <span className="person person-a" />
          <span className="person person-b" />
          <span className="person person-c" />
          <span className="seedling seedling-a" />
          <span className="seedling seedling-b" />
          <span className="seedling seedling-c" />
        </div>
      </div>
      <div>
        <p className="cp-eyebrow">Field Reality</p>
        <h2 className="tracking-tight">Built for the people doing the restoration work.</h2>
        <p>
          Local communities, schools, NGOs, and field workers need tools that work in real conditions: changing
          weather, limited connectivity, shared devices, and high accountability.
        </p>
        <div className="cp-feature-list">
          {fieldFeatures.map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection({ steps }: { steps: WorkflowStep[] }) {
  return (
    <section className="cp-section" id="how-it-works">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">CanopyProof Solution</p>
        <h2 className="tracking-tight">From field evidence to verified environmental impact.</h2>
        <p>
          CanopyProof connects mobile reports, GPS metadata, satellite imagery, community observations, and ecological
          models into one transparent verification workflow.
        </p>
      </div>
      <div className="cp-traceability">
        {steps.map((step, index) => (
          <GlassCard className="cp-step-card" key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3 className="tracking-tight">{step.title}</h3>
            <p>{step.description}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

function MobileReportingShowcase() {
  return (
    <section className="cp-section cp-mobile-section">
      <div>
        <p className="cp-eyebrow">Mobile Reporting Interface</p>
        <h2 className="tracking-tight">Designed for low-connectivity field conditions.</h2>
        <p>
          Field workers can document restoration activities with GPS, photos, notes, and offline sync using simple
          mobile workflows that fit real community operations.
        </p>
        <div className="cp-feature-list cp-feature-list-tight">
          {reportingOptions.map((option) => (
            <span key={option}>{option}</span>
          ))}
        </div>
      </div>
      <div className="cp-phone" aria-label="Sample mobile reporting interface">
        <div className="cp-phone-bar">
          <span>9:41</span>
          <span>Offline ready</span>
        </div>
        <h3 className="tracking-tight">New Field Report</h3>
        <p className="cp-muted">Step 1 of 4 · sample interface</p>
        <div className="cp-phone-options">
          {reportingOptions.slice(0, 4).map((option) => (
            <button key={option} type="button">
              {option}
            </button>
          ))}
        </div>
        <GlassCard className="cp-location-card">
          <strong>Location captured</strong>
          <span>GPS accuracy: 5m · photo metadata saved locally</span>
        </GlassCard>
        <button className="cp-button cp-button-primary cp-phone-button" type="button">
          Save and Sync Later
        </button>
      </div>
    </section>
  );
}

function VerificationPipeline() {
  return (
    <section className="cp-section cp-pipeline" id="methodology">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">AI-Assisted Verification Pipeline</p>
        <h2 className="tracking-tight">Multi-source verification, not blind trust.</h2>
        <p>
          CanopyProof compares field submissions with location metadata, satellite imagery, community observations, and
          ecological models. AI-assisted checks support human and scientific review.
        </p>
      </div>
      <div className="cp-pipeline-grid">
        <GlassCard>
          <h3 className="tracking-tight">Evidence inputs</h3>
          <ul>
            {verificationInputs.map((input) => (
              <li key={input}>{input}</li>
            ))}
          </ul>
        </GlassCard>
        <div className="cp-engine" aria-label="Verification engine">
          <CanopyProofLogo alt="CanopyProof" size={128} />
          <strong className="tracking-tight">Verification Engine</strong>
          <span>human review · scientific context · audit trail</span>
        </div>
        <GlassCard>
          <h3 className="tracking-tight">Verification outputs</h3>
          <ul>
            {verificationOutputs.map((output) => (
              <li key={output}>{output}</li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Module 3 — Explorer + cryptographic certificate                     */
/* ------------------------------------------------------------------ */

function ExplorerPreview({ metrics, records }: { metrics: ExplorerMetric[]; records: ProofRecord[] }) {
  return (
    <section className="cp-section" id="explorer">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">CanopyProof Explorer Preview</p>
        <h2 className="tracking-tight">A public explorer for verified ecological restoration.</h2>
        <p>
          Track restoration status, verified records, certificates, timelines, and proof references through a clean
          accountability interface. All values shown here are sample interface data.
        </p>
      </div>
      <GlassCard className="cp-explorer-shell">
        <div className="cp-explorer-topbar">
          <strong className="tracking-tight">CanopyProof Explorer</strong>
          <span>sample interface · demo data</span>
        </div>
        <div className="cp-explorer-grid">
          <div className="cp-explorer-map" aria-label="Sample global ecological restoration map">
            <span className="map-land land-a" />
            <span className="map-land land-b" />
            <span className="map-land land-c" />
            <span className="map-point point-a">12</span>
            <span className="map-point point-b">28</span>
            <span className="map-point point-c">9</span>
          </div>
          <div className="cp-activity-panel">
            <h3 className="tracking-tight">Recent activity</h3>
            <ol>
              <li>Community report submitted · 12 min ago</li>
              <li>Satellite cross-check completed · 38 min ago</li>
              <li>Impact certificate updated · 2 hrs ago</li>
            </ol>
          </div>
        </div>
        <div className="cp-metrics-row">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong className="tabular-nums">{metric.value}</strong>
              <small>{metric.context}</small>
            </div>
          ))}
        </div>
        <div className="cp-proof-table" role="table" aria-label="Sample proof record table">
          <div className="cp-proof-row cp-proof-head" role="row">
            <span role="columnheader">Record</span>
            <span role="columnheader">Project</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Proof reference</span>
          </div>
          {records.map((record) => (
            <div className="cp-proof-row" key={record.id} role="row">
              <span role="cell" className="font-mono text-[13px]">
                {record.id}
              </span>
              <span role="cell">{record.project}</span>
              <span role="cell">
                <mark>{record.status}</mark>
              </span>
              <span role="cell" className="font-mono text-[13px]">
                {record.proof}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

function ImpactCertificateSection() {
  const cert = sampleCertificate;
  return (
    <section className="cp-section cp-certificate-section">
      <div>
        <p className="cp-eyebrow">Impact Certificate</p>
        <h2 className="tracking-tight">Certificates with the weight of a proof token.</h2>
        <p>
          Each certificate links project type, location, area, evidence sources, verification status, and a proof
          reference. Certificates are proof records, not certified carbon credits.
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 backdrop-blur-md shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
          <span className="flex items-center gap-3">
            <CanopyProofLogo size={44} />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]">
              Verified proof record
            </span>
          </span>
          <span className="font-mono text-[11px] tracking-tight text-zinc-500">{cert.tag}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{cert.recordId}</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">{cert.title}</h3>
          </div>
          <p className="font-mono text-[12px] tracking-tight text-zinc-400">Verified on {cert.verifiedOn}</p>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {cert.fields.map((field: CertificateField) => (
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-4 py-3" key={field.label}>
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">{field.label}</dt>
              <dd className="mt-1 text-[14px] tracking-tight text-zinc-100">{field.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <ImpactTimeline checkpoints={cert.timeline} />
          <SurvivalRing value={cert.survival.value} label={cert.survival.label} note={cert.survival.note} />
        </div>
      </div>
    </section>
  );
}

function ImpactTimeline({ checkpoints }: { checkpoints: CertificateCheckpoint[] }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Impact timeline</p>
      <ol className="mt-3 grid gap-3">
        {checkpoints.map((checkpoint) => (
          <li className="flex items-start gap-3" key={checkpoint.phase}>
            <span
              aria-hidden="true"
              className={
                checkpoint.state === "active"
                  ? "mt-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                  : "mt-1 h-2 w-2 rounded-full bg-emerald-500/70"
              }
            />
            <span>
              <span className="block text-[13px] font-semibold tracking-tight text-zinc-200">{checkpoint.phase}</span>
              <span className="block text-[12px] text-zinc-500">{checkpoint.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SurvivalRing({ value, label, note }: { value: string; label: string; note: string }) {
  const pct = Number.parseInt(value, 10);
  const safePct = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        role="img"
        aria-label={`${label}: ${value} (sample)`}
        style={{
          background: `conic-gradient(rgb(16 185 129) ${safePct}%, rgb(63 63 70 / 0.4) ${safePct}% 100%)`,
        }}
      >
        <span className="grid h-[78px] w-[78px] place-items-center rounded-full bg-zinc-950">
          <span className="text-xl font-semibold tracking-tight tabular-nums text-emerald-400">{value}</span>
        </span>
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 max-w-[12rem] text-[11px] text-zinc-500">{note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Module 4 — TerraProof geospatial telemetry                          */
/* ------------------------------------------------------------------ */

function TerraProofTelemetry({
  series,
  layers,
  risks,
}: {
  series: TelemetryPoint[];
  layers: TelemetryLayer[];
  risks: RiskIndicator[];
}) {
  const latest = series[series.length - 1];
  const first = series[0];
  const net =
    latest && first && first.km > 0 ? Math.round(((latest.km - first.km) / first.km) * 1000) / 10 : 0;

  return (
    <section className="cp-section" id="telemetry">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">TerraProof · Earth Observation</p>
        <h2 className="tracking-tight">Satellite telemetry, framed as mission control.</h2>
        <p>
          Restoration is monitored before and after intervention. The panel below is a sample telemetry interface —
          satellite, vegetation, and hydrology layers rendered as a tactical control matrix.
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            terraproof.telemetry
          </span>
          <span className="font-mono text-[11px] tracking-tight text-zinc-500">sample telemetry · demo data</span>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <WaterRestorationChart series={series} net={net} />
          <div className="grid gap-4">
            <LayerToggleList layers={layers} />
            <RiskMatrix risks={risks} />
          </div>
        </div>
      </div>
    </section>
  );
}

function WaterRestorationChart({ series, net }: { series: TelemetryPoint[]; net: number }) {
  const max = series.reduce((acc, point) => Math.max(acc, point.km), 0) || 1;
  const latest = series[series.length - 1];
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Water restoration index</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-zinc-50">
            {latest ? `${latest.km.toFixed(1)} km` : "—"}
          </p>
        </div>
        <p className="font-mono text-[12px] tracking-tight text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.25)]">
          {net >= 0 ? `+${net}%` : `${net}%`} net
        </p>
      </div>
      <div className="mt-5 flex h-40 items-end gap-3" aria-hidden="true">
        {series.map((point, index) => {
          const heightPct = Math.max((point.km / max) * 100, 4);
          const isLatest = index === series.length - 1;
          return (
            <div className="flex flex-1 flex-col items-center gap-2" key={point.period}>
              <div
                className={
                  isLatest
                    ? "w-full rounded-t bg-gradient-to-t from-emerald-500/30 to-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                    : "w-full rounded-t bg-gradient-to-t from-zinc-700/40 to-zinc-500/70"
                }
                style={{ height: `${heightPct}%` }}
              />
              <span className="font-mono text-[10px] tracking-tight text-zinc-500">{point.period}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LayerToggleList({ layers }: { layers: TelemetryLayer[] }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Data layers</p>
      <ul className="mt-3 grid gap-2">
        {layers.map((layer) => (
          <li
            className="group flex items-center justify-between gap-3 rounded-md border border-zinc-800/60 bg-zinc-950/40 px-3 py-2.5 transition-colors hover:border-emerald-500/40"
            key={layer.label}
          >
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={
                  layer.active
                    ? "grid h-4 w-4 place-items-center rounded-[5px] border border-emerald-400/60 bg-emerald-400/15 text-[10px] text-emerald-400"
                    : "h-4 w-4 rounded-[5px] border border-zinc-700"
                }
              >
                {layer.active ? "✓" : ""}
              </span>
              <span className="text-[13px] tracking-tight text-zinc-200">{layer.label}</span>
            </span>
            <span
              className={
                layer.active
                  ? "font-mono text-[11px] tracking-tight text-emerald-400"
                  : "font-mono text-[11px] tracking-tight text-zinc-600"
              }
            >
              {layer.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskMatrix({ risks }: { risks: RiskIndicator[] }) {
  const toneClass: Record<RiskIndicator["level"], string> = {
    Normal: "text-emerald-400",
    Watch: "text-amber-400",
    Elevated: "text-rose-400",
  };
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Resilience signals</p>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {risks.slice(0, 6).map((risk) => (
          <div className="rounded-md border border-zinc-800/60 bg-zinc-950/40 px-3 py-2" key={risk.label}>
            <dt className="text-[11px] text-zinc-500">{risk.label}</dt>
            <dd className={`mt-0.5 text-[14px] font-semibold tracking-tight tabular-nums ${toneClass[risk.level]}`}>
              {risk.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ecosystem + Module 5 (open stack) + closing                         */
/* ------------------------------------------------------------------ */

function EcosystemNetwork() {
  return (
    <section className="cp-section cp-network">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">Ecosystem Network</p>
        <h2 className="tracking-tight">Transparent accountability across the restoration ecosystem.</h2>
      </div>
      <div className="cp-network-orbit">
        <div className="cp-network-center">
          <CanopyProofLogo alt="CanopyProof" size={116} />
          <strong className="tracking-tight">CanopyProof</strong>
        </div>
        {ecosystemNodes.map((node) => (
          <span key={node}>{node}</span>
        ))}
      </div>
    </section>
  );
}

function InfraStackSection({ layers }: { layers: StackLayer[] }) {
  return (
    <section className="cp-section" id="stack">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">Open Climate Infrastructure</p>
        <h2 className="tracking-tight">A five-layer open stack for climate accountability.</h2>
        <p>
          CanopyProof is designed as public-interest infrastructure: open standards, transparent evidence, and
          verifiable outputs from raw signal to application.
        </p>
      </div>
      <div className="grid gap-3">
        {layers.map((layer) => (
          <div
            className="group grid items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 backdrop-blur-md transition-colors hover:border-emerald-500/40 sm:grid-cols-[auto_1fr_2fr]"
            key={layer.index}
          >
            <span className="font-mono text-2xl font-semibold tabular-nums text-emerald-400/70 transition-colors group-hover:text-emerald-400">
              {layer.index}
            </span>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-100">{layer.name}</h3>
            <div className="flex flex-wrap gap-2">
              {layer.items.map((item) => (
                <span
                  className="rounded-md border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 font-mono text-[12px] tracking-tight text-zinc-400"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="cp-section cp-closing" id="contact">
      <CanopyProofLogo size={104} />
      <p className="cp-eyebrow">Dropin · CanopyProof</p>
      <h2 className="tracking-tight">Technology for nature. Accountability for all.</h2>
      <p>
        Turning environmental action into accountable evidence so trust can flow back to the people and ecosystems
        restoring our planet.
      </p>
      <div className="cp-hero-actions">
        <a className="cp-button cp-button-primary" href="#explorer">
          View Proof Explorer
        </a>
        <a className="cp-button cp-button-secondary" href="/feedback">
          Partner With Us
        </a>
        <a className="cp-button cp-button-ghost" href="#methodology">
          Read Methodology
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="cp-footer">
      <div>
        <strong className="tracking-tight">CanopyProof by Dropin</strong>
        <p>Transparent. Verified. Restored.</p>
      </div>
      <p>Public-interest climate infrastructure for people and planet.</p>
      <p>
        Prototype transparency: metrics, certificates, telemetry, and selected visual scenes on this page are sample
        interface data for workflow demonstration. Production proof records require approved evidence sources and
        review; nothing here is a certified carbon credit or a verified claim about a specific real-world project.
      </p>
    </footer>
  );
}
