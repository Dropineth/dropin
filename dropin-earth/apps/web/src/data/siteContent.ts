export type WorkflowStep = {
  title: string;
  description: string;
};

export type ExplorerMetric = {
  label: string;
  value: string;
  context: string;
};

export type ProofRecord = {
  id: string;
  project: string;
  location: string;
  status: "Verified" | "In review" | "Monitoring";
  proof: string;
};

export type RiskIndicator = {
  label: string;
  value: string;
  level: "Normal" | "Watch" | "Elevated";
};

export type StatusSignal = {
  label: string;
  state: string;
  tone: "ok" | "watch";
};

export type InstitutionalMetric = {
  label: string;
  value: string;
  delta: string;
  window: string;
};

export type IngestionStage = {
  index: string;
  title: string;
  detail: string;
};

export type CertificateField = {
  label: string;
  value: string;
};

export type CertificateCheckpoint = {
  phase: string;
  note: string;
  state: "done" | "active";
};

export type SampleCertificate = {
  tag: string;
  title: string;
  recordId: string;
  verifiedOn: string;
  fields: CertificateField[];
  timeline: CertificateCheckpoint[];
  survival: { label: string; value: string; note: string };
};

export type TelemetryPoint = {
  period: string;
  km: number;
};

export type TelemetryLayer = {
  label: string;
  value: string;
  active: boolean;
};

export type StackLayer = {
  index: string;
  name: string;
  items: string[];
};

export const prototypeDemo = {
  label: "Watch 2-minute prototype demo",
  href: "https://www.youtube.com/",
  externalLabel: "Opens the CanopyProof prototype demo video in a new tab",
} as const;

// Clearly-labeled interface-preview status (not a real-time operational feed).
export const systemStatusSignals: StatusSignal[] = [
  { label: "Routing protocol", state: "All systems operational", tone: "ok" },
  { label: "Satellite feed", state: "Reference layer", tone: "ok" },
  { label: "AI verification", state: "Assistive · human-reviewed", tone: "ok" },
];

// Illustrative figures for interface preview — not audited production totals.
export const institutionalMetrics: InstitutionalMetric[] = [
  { label: "Trees restored", value: "24.7M", delta: "+18.2%", window: "vs last 30 days" },
  { label: "CO₂e sequestered", value: "812,534 t", delta: "+22.1%", window: "vs last 30 days" },
  { label: "Projects verified", value: "248", delta: "+16.4%", window: "across 23 countries" },
];

export const transparencyBefore = [
  "Opaque funding flows",
  "Disconnected spreadsheets",
  "Paper field notes",
  "Email attachments",
  "Unverified claims",
  "No shared source of truth",
] as const;

export const ingestionPipeline: IngestionStage[] = [
  { index: "01", title: "Evidence capture", detail: "Field photo, GPS, notes, community sign-off." },
  { index: "02", title: "Metadata / EXIF ingestion", detail: "Time, location, and device integrity extracted." },
  { index: "03", title: "AI verification engine", detail: "Cross-checked against satellite layers and ecological models." },
  { index: "04", title: "Immutable open ledger", detail: "Accepted evidence written to an append-only proof root." },
];

export const problemCards = [
  {
    title: "Fragmented coordination",
    copy:
      "Paper records, disconnected spreadsheets, and low-connectivity tools make restoration work difficult to coordinate.",
  },
  {
    title: "Unverifiable claims",
    copy:
      "Environmental impact is often reported without consistent evidence, context, or traceability.",
  },
  {
    title: "Opaque funding flows",
    copy:
      "Funders and communities lack a shared view of what was funded, where it happened, and what changed.",
  },
] as const;

export const fieldFeatures = [
  "Offline-first reporting",
  "GPS and photo metadata",
  "Low-bandwidth sync",
  "Community-owned evidence",
  "Simple mobile workflows",
] as const;

export const reportingOptions = [
  "Tree planting",
  "Water restoration",
  "Biodiversity observation",
  "GPS location",
  "Photo evidence",
  "Offline mode",
] as const;

export const workflowSteps: WorkflowStep[] = [
  {
    title: "Reported",
    description: "Field teams capture activity, location, notes, photos, and local context.",
  },
  {
    title: "Verified",
    description: "Evidence is cross-checked against metadata, maps, observations, and scientific review.",
  },
  {
    title: "Recorded",
    description: "Accepted proof records are written into an auditable environmental timeline.",
  },
  {
    title: "Monitored",
    description: "Restoration outcomes continue to be observed through field and remote signals.",
  },
  {
    title: "Impact Confirmed",
    description: "Certificates reference evidence sources, proof identifiers, and monitoring status.",
  },
];

export const verificationInputs = [
  "Mobile reports",
  "Satellite data",
  "Community observations",
  "Ecological models",
  "Field worker evidence",
  "Restoration maps",
] as const;

export const verificationOutputs = [
  "Verified restoration record",
  "Impact certificate",
  "Risk flag",
  "Environmental state transition",
  "Proof reference",
  "Audit-ready evidence pack",
] as const;

export const explorerMetrics: ExplorerMetric[] = [
  { label: "Active projects", value: "38", context: "sample interface" },
  { label: "Hectares restored", value: "12,480", context: "demo data" },
  { label: "Trees restored", value: "1.8M", context: "demo data" },
  { label: "Communities engaged", value: "126", context: "sample interface" },
  { label: "Water systems improved", value: "42", context: "demo data" },
  { label: "Verified records", value: "4,812", context: "demo data" },
];

export const proofRecords: ProofRecord[] = [
  {
    id: "CPR-2026-0018",
    project: "Watershed restoration",
    location: "Semi-arid community corridor",
    status: "Verified",
    proof: "root:8fe4...42a1",
  },
  {
    id: "CPR-2026-0024",
    project: "Community nursery planting",
    location: "Upland school network",
    status: "Monitoring",
    proof: "root:41ab...9d77",
  },
  {
    id: "CPR-2026-0031",
    project: "Biodiversity observation",
    location: "Riparian restoration zone",
    status: "In review",
    proof: "root:d903...75be",
  },
];

// Sample certificate. Intentionally NOT bound to a real, named place: a fixed
// certificate ID + "verified on" date attached to a real ecosystem would assert
// a verification that has not occurred. Swap in approved project data to publish.
export const sampleCertificate: SampleCertificate = {
  tag: "Sample certificate · demo data",
  title: "Watershed Restoration Proof",
  recordId: "CPR-SAMPLE-0001847",
  verifiedOn: "May 18, 2026 (sample record)",
  fields: [
    { label: "Project type", value: "Watershed restoration" },
    { label: "Location", value: "Community watershed corridor (sample)" },
    { label: "Area", value: "1,245 ha (sample)" },
    { label: "Trees planted", value: "128,450 (sample)" },
    { label: "Evidence sources", value: "Mobile report, GPS/EXIF, satellite cross-check" },
    { label: "Verified status", value: "Verified with monitoring" },
  ],
  timeline: [
    { phase: "Baseline verification", note: "Evidence root recorded", state: "done" },
    { phase: "Field monitoring", note: "Community + GPS resubmission", state: "done" },
    { phase: "Satellite cross-check", note: "NDVI delta confirmed", state: "done" },
    { phase: "AI survival check", note: "Human-reviewed survival estimate", state: "active" },
  ],
  survival: {
    label: "AI survival check",
    value: "81%",
    note: "Sample baseline · assistive estimate, human-reviewed",
  },
};

// Sample telemetry series for the water-restoration index (demo data).
export const waterRestorationSeries: TelemetryPoint[] = [
  { period: "Jan 2023", km: 5.0 },
  { period: "May 2023", km: 9.4 },
  { period: "Sep 2023", km: 14.1 },
  { period: "Jan 2024", km: 19.6 },
  { period: "May 2024", km: 24.8 },
];

export const telemetryLayers: TelemetryLayer[] = [
  { label: "Satellite imagery", value: "True-color", active: true },
  { label: "Forest health", value: "NDVI 0.78", active: true },
  { label: "Carbon density", value: "Modeled", active: false },
  { label: "Land cover change", value: "2019–2024", active: false },
];

export const riskIndicators: RiskIndicator[] = [
  { label: "Drought risk", value: "Watch", level: "Watch" },
  { label: "Wildfire risk", value: "Elevated", level: "Elevated" },
  { label: "Soil moisture", value: "36%", level: "Watch" },
  { label: "Rainfall", value: "-12%", level: "Watch" },
  { label: "Temperature", value: "+1.4C", level: "Elevated" },
  { label: "Vegetation health", value: "Recovering", level: "Normal" },
  { label: "Communities at risk", value: "7", level: "Elevated" },
  { label: "Recommended actions", value: "4", level: "Normal" },
];

export const ecosystemNodes = [
  "Communities",
  "Schools",
  "NGOs",
  "Local governments",
  "Field workers",
  "Researchers",
  "Funders",
  "Restoration projects",
] as const;

export const infraStack: StackLayer[] = [
  { index: "01", name: "Data sources", items: ["Satellite", "In-situ IoT", "Community mobile data"] },
  { index: "02", name: "Ingestion layer", items: ["Connectors", "Validation engine", "Schema check"] },
  {
    index: "03",
    name: "Protocol layer",
    items: ["Open Climate Protocol ocp://", "Impact Accounting OIP", "Verification OVP"],
  },
  { index: "04", name: "Verification layer", items: ["Cross-validation", "Decentralized attestation", "Consensus"] },
  { index: "05", name: "Application layer", items: ["Impact dashboards", "Carbon accounting", "Early warning"] },
];

export const openInfrastructureCards = [
  "Open standards",
  "Transparent evidence",
  "Scientific review",
  "Community participation",
  "Audit-ready records",
] as const;
