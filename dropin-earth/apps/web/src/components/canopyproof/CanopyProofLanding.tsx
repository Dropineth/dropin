import {
  ecosystemNodes,
  explorerMetrics,
  fieldFeatures,
  openInfrastructureCards,
  problemCards,
  prototypeDemo,
  proofRecords,
  reportingOptions,
  riskIndicators,
  verificationInputs,
  verificationOutputs,
  workflowSteps,
} from "@/data/siteContent";
import { DropinMark } from "./DropinMark";
import { EarthOrb } from "./EarthOrb";
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
    "CanopyProof by Dropin turns restoration evidence into transparent environmental records, impact certificates, and traceable proof workflows.",
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
      <ProblemSection />
      <FieldRealitySection />
      <SolutionSection />
      <MobileReportingShowcase />
      <VerificationPipeline />
      <ExplorerPreview />
      <ImpactCertificateSection />
      <EarlyWarningPreview />
      <EcosystemNetwork />
      <OpenInfrastructureSection />
      <BeforeAfterSection />
      <ClosingCTA />
      <Footer />
    </main>
  );
}

function Navbar() {
  const links = [
    { href: "#product", label: "Product" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#explorer", label: "Explorer" },
    { href: "#methodology", label: "Methodology" },
    { href: "#open-infrastructure", label: "Open Infrastructure" },
    { href: "#contact", label: "Contact" },
  ] as const;

  return (
    <header className="cp-nav">
      <a aria-label="CanopyProof home" className="cp-brand" href="#top">
        <DropinMark size={42} />
        <span>
          <strong>CanopyProof</strong>
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

function HeroSection() {
  return (
    <section className="cp-hero" id="top">
      <div className="cp-hero-copy">
        <p className="cp-eyebrow">CanopyProof by Dropin</p>
        <h1>Environmental accountability. Verified. Transparent. Restored.</h1>
        <p className="cp-lede">
          CanopyProof connects field evidence, satellite data, community observations, and AI-assisted ecological models into one transparent proof system for real-world restoration.
        </p>
        <div className="cp-hero-actions" aria-label="Primary actions">
          <a className="cp-button cp-button-primary" href="#explorer">
            Explore the Proof System
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
      </div>
      <div className="cp-hero-visual">
        <EarthOrb />
        <GlassCard className="cp-hero-panel">
          <span className="cp-status-dot" />
          <div>
            <strong>Sample proof workflow</strong>
            <p>{"Reported -> Verified -> Recorded -> Monitored -> Impact Confirmed"}</p>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="cp-section cp-problem" id="product">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">The Problem</p>
        <h2>Restoration is happening. Trust is fragmented.</h2>
        <p>
          Across climate-vulnerable regions, communities are planting trees, restoring water systems, protecting biodiversity, and rebuilding resilience. But impact is often scattered across paper records, disconnected spreadsheets, low-connectivity devices, and unverifiable reports.
        </p>
      </div>
      <div className="cp-problem-grid">
        <div className="cp-fragment-visual" aria-hidden="true">
          <span className="paper paper-a" />
          <span className="paper paper-b" />
          <span className="paper paper-c" />
          <span className="broken-line line-a" />
          <span className="broken-line line-b" />
          <span className="broken-line line-c" />
        </div>
        <div className="cp-card-stack">
          {problemCards.map((card) => (
            <GlassCard key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

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
        <h2>Built for the people doing the restoration work.</h2>
        <p>
          Local communities, schools, NGOs, and field workers need tools that work in real conditions: changing weather, limited connectivity, shared devices, and high accountability.
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

function SolutionSection() {
  return (
    <section className="cp-section" id="how-it-works">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">CanopyProof Solution</p>
        <h2>From field evidence to verified environmental impact.</h2>
        <p>
          CanopyProof connects mobile reports, GPS metadata, satellite imagery, community observations, and ecological models into one transparent verification workflow.
        </p>
      </div>
      <div className="cp-traceability">
        {workflowSteps.map((step, index) => (
          <GlassCard className="cp-step-card" key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{step.title}</h3>
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
        <h2>Designed for low-connectivity field conditions.</h2>
        <p>
          Field workers can document restoration activities with GPS, photos, notes, and offline sync using simple mobile workflows that fit real community operations.
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
        <h3>New Field Report</h3>
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
        <h2>Multi-source verification, not blind trust.</h2>
        <p>
          CanopyProof compares field submissions with location metadata, satellite imagery, community observations, and ecological models. AI-assisted checks support human and scientific review.
        </p>
      </div>
      <div className="cp-pipeline-grid">
        <GlassCard>
          <h3>Evidence inputs</h3>
          <ul>
            {verificationInputs.map((input) => (
              <li key={input}>{input}</li>
            ))}
          </ul>
        </GlassCard>
        <div className="cp-engine" aria-label="Verification engine">
          <DropinMark size={128} />
          <strong>Verification Engine</strong>
          <span>human review · scientific context · audit trail</span>
        </div>
        <GlassCard>
          <h3>Verification outputs</h3>
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

function ExplorerPreview() {
  return (
    <section className="cp-section" id="explorer">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">CanopyProof Explorer Preview</p>
        <h2>A public explorer for verified ecological restoration.</h2>
        <p>
          Track restoration status, verified records, certificates, timelines, and proof references through a clean accountability interface. All values shown here are sample interface data.
        </p>
      </div>
      <GlassCard className="cp-explorer-shell">
        <div className="cp-explorer-topbar">
          <strong>CanopyProof Explorer</strong>
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
            <h3>Recent activity</h3>
            <ol>
              <li>Community report submitted · 12 min ago</li>
              <li>Satellite cross-check completed · 38 min ago</li>
              <li>Impact certificate updated · 2 hrs ago</li>
            </ol>
          </div>
        </div>
        <div className="cp-metrics-row">
          {explorerMetrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
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
          {proofRecords.map((record) => (
            <div className="cp-proof-row" key={record.id} role="row">
              <span role="cell">{record.id}</span>
              <span role="cell">{record.project}</span>
              <span role="cell">
                <mark>{record.status}</mark>
              </span>
              <span role="cell">{record.proof}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

function ImpactCertificateSection() {
  return (
    <section className="cp-section cp-certificate-section">
      <div>
        <p className="cp-eyebrow">Impact Certificate</p>
        <h2>Impact certificates with traceable evidence.</h2>
        <p>
          Each certificate links project type, location, date, evidence sources, verification status, ecological impact, and a proof reference. Certificates are proof records, not certified carbon credits.
        </p>
      </div>
      <GlassCard className="cp-certificate">
        <div className="cp-certificate-seal">
          <DropinMark size={78} />
          <span>Verified proof record</span>
        </div>
        <div>
          <p className="cp-eyebrow">Sample certificate</p>
          <h3>Riparian Restoration Proof</h3>
        </div>
        <dl className="cp-certificate-fields">
          <div>
            <dt>Project type</dt>
            <dd>Water and vegetation restoration</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>Community watershed corridor</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>May 17, 2026</dd>
          </div>
          <div>
            <dt>Verified status</dt>
            <dd>Verified with monitoring</dd>
          </div>
          <div>
            <dt>Ecological impact</dt>
            <dd>Soil stability and vegetation recovery observed</dd>
          </div>
          <div>
            <dt>Verification confidence</dt>
            <dd>High confidence · sample value</dd>
          </div>
        </dl>
        <div className="cp-certificate-bottom">
          <div className="cp-qr" aria-label="QR-style proof reference">
            {Array.from({ length: 25 }, (_, index) => (
              <span className={index % 3 === 0 || index === 7 || index === 18 ? "filled" : ""} key={index} />
            ))}
          </div>
          <p>Evidence sources: mobile report, GPS metadata, field photos, community observation, satellite cross-check.</p>
        </div>
      </GlassCard>
    </section>
  );
}

function EarlyWarningPreview() {
  return (
    <section className="cp-section cp-warning-section">
      <GlassCard className="cp-warning-dashboard">
        <div className="cp-explorer-topbar">
          <strong>Climate Resilience Early-Warning Preview</strong>
          <span>sample interface · demo data</span>
        </div>
        <div className="cp-risk-grid">
          {riskIndicators.map((indicator) => (
            <div className={`cp-risk cp-risk-${indicator.level.toLowerCase()}`} key={indicator.label}>
              <span>{indicator.label}</span>
              <strong>{indicator.value}</strong>
            </div>
          ))}
        </div>
        <div className="cp-risk-map" aria-label="Sample environmental monitoring map">
          <span className="risk-zone risk-zone-a" />
          <span className="risk-zone risk-zone-b" />
          <span className="risk-zone risk-zone-c" />
        </div>
      </GlassCard>
      <div>
        <p className="cp-eyebrow">Climate Resilience</p>
        <h2>Monitoring before and after restoration.</h2>
        <p>
          CanopyProof is designed to support coordination around drought risk, wildfire risk, soil moisture, rainfall, temperature, vegetation health, communities at risk, and recommended actions.
        </p>
      </div>
    </section>
  );
}

function EcosystemNetwork() {
  return (
    <section className="cp-section cp-network">
      <div className="cp-section-heading">
        <p className="cp-eyebrow">Ecosystem Network</p>
        <h2>Transparent accountability across the restoration ecosystem.</h2>
      </div>
      <div className="cp-network-orbit">
        <div className="cp-network-center">
          <DropinMark size={116} />
          <strong>CanopyProof</strong>
        </div>
        {ecosystemNodes.map((node) => (
          <span key={node}>{node}</span>
        ))}
      </div>
    </section>
  );
}

function OpenInfrastructureSection() {
  return (
    <section className="cp-section cp-open" id="open-infrastructure">
      <div>
        <p className="cp-eyebrow">Open Infrastructure</p>
        <h2>Open infrastructure for a climate-resilient future.</h2>
        <p>
          CanopyProof is designed as public-interest climate infrastructure: transparent, verifiable, community-centered, and built for real-world restoration.
        </p>
      </div>
      <div className="cp-open-grid">
        {openInfrastructureCards.map((card) => (
          <GlassCard key={card}>
            <h3>{card}</h3>
            <p>Designed for accountable climate coordination and conservative public proof workflows.</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

function BeforeAfterSection() {
  return (
    <section className="cp-section cp-before-after">
      <div className="cp-restoration-panel cp-degraded">
        <span>Before</span>
        <h3>Degraded dry land</h3>
        <p>Climate stress, vulnerable communities, and fragmented records.</p>
      </div>
      <div className="cp-transition-arc" aria-hidden="true" />
      <div className="cp-restoration-panel cp-restored">
        <span>After</span>
        <h3>Restored green landscape</h3>
        <p>Water systems, healthy vegetation, and accountable community evidence.</p>
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="cp-section cp-closing" id="contact">
      <DropinMark size={104} />
      <p className="cp-eyebrow">Dropin · CanopyProof</p>
      <h2>Technology for nature. Accountability for all.</h2>
      <p>
        Turning environmental action into accountable evidence so trust can flow back to the people and ecosystems restoring our planet.
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
        <strong>CanopyProof by Dropin</strong>
        <p>Transparent. Verified. Restored.</p>
      </div>
      <p>Public-interest climate infrastructure for people and planet.</p>
      <p>
        Prototype transparency: sample metrics and selected visual scenes are used for workflow
        demonstration; production proof records require approved evidence sources and review.
      </p>
    </footer>
  );
}
