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

export const prototypeDemo = {
  label: "Watch 2-minute prototype demo",
  href: "https://www.youtube.com/",
  externalLabel: "Opens the CanopyProof prototype demo video in a new tab",
} as const;

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

export const openInfrastructureCards = [
  "Open standards",
  "Transparent evidence",
  "Scientific review",
  "Community participation",
  "Audit-ready records",
] as const;
