export type OperationalTone = "ok" | "watch" | "review" | "critical";

export type CanopyProofLayer = "Evidence" | "Verification" | "Governance" | "Impact";

export type CanopyMetric = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: OperationalTone;
};

export type CanopyPanel = {
  readonly title: string;
  readonly body: string;
  readonly items: readonly string[];
  readonly tone: OperationalTone;
};

export type CanopyWorkflowStep = {
  readonly label: string;
  readonly owner: string;
  readonly state: string;
  readonly detail: string;
};

export type CanopyMapPoint = {
  readonly label: string;
  readonly region: string;
  readonly x: number;
  readonly y: number;
  readonly tone: OperationalTone;
};

export type CanopyProofOSModule = {
  readonly route: string;
  readonly layer: CanopyProofLayer;
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly primaryAction: string;
  readonly secondaryAction: string;
  readonly metrics: readonly CanopyMetric[];
  readonly panels: readonly CanopyPanel[];
  readonly workflow: readonly CanopyWorkflowStep[];
  readonly mapPoints?: readonly CanopyMapPoint[];
};

export type EvidenceSchemaField = {
  readonly key: string;
  readonly purpose: string;
  readonly verification: string;
};

export const canopyProofOsRoutes = [
  { href: "/dashboard/global", label: "Global" },
  { href: "/mobile/report", label: "Evidence" },
  { href: "/terra", label: "TerraProof" },
  { href: "/reports/esg", label: "ESG" },
  { href: "/governance", label: "Governance" },
  { href: "/partners", label: "Partners" },
  { href: "/funding", label: "Funding" },
  { href: "/risk", label: "Risk" },
] as const;

export const canopyProofAgents = [
  "Evidence Agent",
  "Verification Agent",
  "ESG Agent",
  "Funding Agent",
  "Risk Agent",
  "Community Agent",
] as const;

export const ahinEventActions = ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"] as const;

export const evidenceSchemaFields: readonly EvidenceSchemaField[] = [
  {
    key: "id",
    purpose: "Stable evidence identifier used for offline sync and audit lineage.",
    verification: "Generated once, replay-safe, and tied to the append-only audit event.",
  },
  {
    key: "location",
    purpose: "Latitude, longitude, accuracy, and privacy mode for environmental context.",
    verification: "Compared against GPS hash, EXIF coordinates, and TerraProof geospatial expectations.",
  },
  {
    key: "timestamp",
    purpose: "Observed time for photos, field reports, sensor readings, or community attestations.",
    verification: "Checked against device time, EXIF time, sync time, and satellite acquisition windows.",
  },
  {
    key: "contributor",
    purpose: "Dropin identity subject for human, organization, agent, or device.",
    verification: "Settlement-grade evidence requires authenticated identity and reputation context.",
  },
  {
    key: "media_hash",
    purpose: "Content-addressed photo, video, document, or sensor artifact.",
    verification: "Duplicate detection, object storage integrity, and proof-root construction.",
  },
  {
    key: "gps_hash",
    purpose: "Privacy-preserving commitment to raw device location signals.",
    verification: "GPS spoofing detection without exposing unnecessary personal data publicly.",
  },
  {
    key: "verification_status",
    purpose: "Current state from submitted through challenged, accepted, revoked, or superseded.",
    verification: "State transitions require policy checks and audit entries.",
  },
  {
    key: "confidence_score",
    purpose: "Bounded confidence estimate from deterministic and AI-assisted checks.",
    verification: "Advisory only; cannot replace human review.",
  },
  {
    key: "reviewers",
    purpose: "Accredited humans and organizations responsible for final review.",
    verification: "RBAC, accreditation, conflict disclosure, and governance approval checks.",
  },
  {
    key: "audit_history",
    purpose: "Append-only mutation trail for evidence, review, certificate, and challenge actions.",
    verification: "Hash-chained audit events with request IDs and policy decisions.",
  },
  {
    key: "offline_sync_id",
    purpose: "Replay-safe identifier for evidence captured without network access.",
    verification: "Synced through idempotent batches; conflicting ID reuse is challenged rather than overwritten.",
  },
  {
    key: "device_fingerprint_hash",
    purpose: "Privacy-preserving commitment to the collection device or field terminal.",
    verification: "Used for duplicate, compromised-device, and GPS-spoofing review without exposing raw device identifiers.",
  },
  {
    key: "exif_hash",
    purpose: "Commitment to raw EXIF metadata extracted from field photos or media.",
    verification: "Compared with timestamp, location, and satellite windows during human review.",
  },
  {
    key: "community_attestations",
    purpose: "Local support, challenge, or needs-review context from accountable community actors.",
    verification: "Can challenge evidence and inform reviewers, but cannot finalize proof.",
  },
  {
    key: "media_objects",
    purpose: "Confirmed object-storage media bound to upload intent, content hash, encryption mode, and malware scan state.",
    verification: "Pending, quarantined, or duplicate media objects remain non-final until accredited review resolves them.",
  },
  {
    key: "consent_receipts",
    purpose: "Privacy-preserving receipts for field evidence collection, geolocation, media upload, and research-sharing consent.",
    verification: "Active consent is required before device-bound EXIF/GPS metadata can enter proof lineage.",
  },
  {
    key: "device_attestations",
    purpose: "Hash-bound device integrity statements for secure enclave, WebAuthn, platform key, field kit, or sensor gateway capture.",
    verification: "Risk flags and low reputation force metadata extraction into human review.",
  },
  {
    key: "media_metadata_extractions",
    purpose: "EXIF/GPS extraction records bound to clean media objects, active consent receipts, and active device attestations.",
    verification: "Metadata hashes, GPS accuracy, privacy mode, and clock skew are evaluated before use in proof records.",
  },
  {
    key: "review_tasks",
    purpose: "Human moderation queue for quarantined media, duplicate media, pending scans, and metadata extraction risks.",
    verification: "Open, assigned, resolved, and escalated tasks keep non-final evidence blocked until accountable review.",
  },
  {
    key: "retention_policy_decisions",
    purpose: "Append-only consent-retention, revocation, minimization, tombstone, and legal-hold decisions.",
    verification: "Retention automation records decisions without silently deleting or mutating evidence lineage.",
  },
  {
    key: "verification_work_items",
    purpose: "Backpressure-aware work queue for validation, advisory AI, TerraProof, human review, and proof issuance.",
    verification: "Dependencies are explicit, AI remains advisory, and proof issuance requires human review before public records.",
  },
] as const;

export const canopyAiCapabilities = [
  "satellite comparison",
  "anomaly detection",
  "duplicate detection",
  "fraud detection",
  "ecological reasoning",
  "survival estimation",
] as const;

export const productionDatabaseSchemas = [
  "identity",
  "organizations",
  "projects",
  "evidence",
  "verification",
  "certificates",
  "satellite",
  "impact",
  "funding",
  "governance",
  "audit",
] as const;

export const globalImpactCommandCenter: CanopyProofOSModule = {
  route: "/dashboard/global",
  layer: "Impact",
  eyebrow: "Global Impact Command Center",
  title: "Planetary restoration operations, evidence, and risk in one command surface.",
  summary:
    "A read-only institutional command center for restoration projects, regions, climate risk, biodiversity indicators, water indicators, and impact metrics. Values are separated by observed, reviewed, challenged, and estimated state.",
  primaryAction: "Open evidence queue",
  secondaryAction: "Review risk layers",
  metrics: [
    { label: "Restoration regions", value: "14", detail: "tracked as operational regions", tone: "ok" },
    { label: "Projects in review", value: "38", detail: "pending evidence or governance checks", tone: "review" },
    { label: "Climate risk layers", value: "4", detail: "drought, wildfire, flooding, degradation", tone: "watch" },
    { label: "Public claim mode", value: "bounded", detail: "proof records, not offsets or yield", tone: "ok" },
  ],
  panels: [
    {
      title: "Earth visualization",
      body: "Map projects, regions, biodiversity, water, and risk without hiding verification state.",
      items: ["global region layer", "project drill-down", "evidence lineage", "certificate state"],
      tone: "ok",
    },
    {
      title: "Impact metrics",
      body: "Separate observed evidence from reviewed proof and estimated environmental impact.",
      items: ["tree observations", "water indicators", "biodiversity signal", "carbon estimates"],
      tone: "review",
    },
    {
      title: "Operational alerts",
      body: "Expose risk signals to communities, NGOs, governments, and project operators.",
      items: ["drought", "wildfire", "flooding", "ecosystem degradation"],
      tone: "watch",
    },
  ],
  workflow: [
    { label: "Region selected", owner: "Impact Layer", state: "read-only", detail: "Public map opens at region scope with verification labels." },
    { label: "Project inspected", owner: "Evidence Layer", state: "linked", detail: "Project cards link to evidence, review, funding, and risk records." },
    { label: "Proof reviewed", owner: "Verification Layer", state: "human gated", detail: "AI can recommend; accredited humans make final decisions." },
    { label: "Record published", owner: "Governance Layer", state: "audited", detail: "Public record includes claims boundary and audit lineage." },
  ],
  mapPoints: [
    { label: "Sahel restoration corridor", region: "Great Green Wall", x: 47, y: 43, tone: "review" },
    { label: "Rift Valley watershed", region: "East Africa", x: 55, y: 56, tone: "ok" },
    { label: "Mekong water resilience", region: "Southeast Asia", x: 73, y: 58, tone: "watch" },
    { label: "Amazon biodiversity buffer", region: "South America", x: 35, y: 67, tone: "critical" },
  ],
};

export const mobileEvidenceNetwork: CanopyProofOSModule = {
  route: "/mobile/report",
  layer: "Evidence",
  eyebrow: "Evidence Collection Network",
  title: "Offline-first field reporting for restoration, water, biodiversity, soil, and climate observations.",
  summary:
    "Mobile evidence is captured locally, hashed before upload, synchronized idempotently, and routed through community verification before it can support a public proof record.",
  primaryAction: "Create offline evidence draft",
  secondaryAction: "Inspect evidence schema",
  metrics: [
    { label: "Report classes", value: "6", detail: "planting, restoration, biodiversity, water, soil, climate", tone: "ok" },
    { label: "Required signals", value: "8", detail: "photo, GPS, timestamp, device, EXIF, sync, scan, community", tone: "review" },
    { label: "Offline mode", value: "idempotent", detail: "sync by evidence ID and media hash", tone: "ok" },
    { label: "Final authority", value: "human", detail: "AI never finalizes evidence", tone: "ok" },
  ],
  panels: [
    {
      title: "Field capture",
      body: "Capture photos, GPS, timestamp, device fingerprint, EXIF metadata, and local notes while offline.",
      items: ["tree planting", "biodiversity", "water project", "soil regeneration"],
      tone: "ok",
    },
    {
      title: "Sync discipline",
      body: "Uploads are content-addressed, scan-gated, and replay-safe; conflicts become review tasks instead of overwrites.",
      items: ["media hash", "encrypted object", "malware scan", "idempotency key"],
      tone: "review",
    },
    {
      title: "Community verification",
      body: "Community observations can support proof, but they remain bounded until accredited review completes.",
      items: ["support", "challenge", "needs review", "audit event"],
      tone: "watch",
    },
  ],
  workflow: [
    { label: "Draft", owner: "Contributor device", state: "offline", detail: "Evidence envelope is created before network availability." },
    { label: "Hash", owner: "Evidence Agent", state: "local", detail: "Media and GPS commitments are calculated before upload." },
    { label: "Sync", owner: "Dropin Memory", state: "idempotent", detail: "Batch sync is replay-safe and conflict-aware." },
    { label: "Attest", owner: "Community", state: "non-final", detail: "Community support or challenge is appended without final authority." },
    { label: "Queue", owner: "Verification Layer", state: "backpressure aware", detail: "Validation, AI, TerraProof, and review work items preserve dependency order." },
    { label: "Review", owner: "Verifier", state: "human gated", detail: "Accepted status requires accredited human review." },
  ],
};

export const terraProofIntelligence: CanopyProofOSModule = {
  route: "/terra",
  layer: "Verification",
  eyebrow: "TerraProof Earth Intelligence",
  title: "Satellite and climate layers for vegetation, water, drought, wildfire, and land-change review.",
  summary:
    "TerraProof connects Sentinel, Landsat, NASA, and open climate datasets into provenance-rich layers used to challenge or support field evidence.",
  primaryAction: "Inspect satellite layers",
  secondaryAction: "Open connector registry",
  metrics: [
    { label: "Connector families", value: "4", detail: "Sentinel, Landsat, NASA, open climate", tone: "ok" },
    { label: "Layer classes", value: "7", detail: "imagery, NDVI, vegetation, water, drought, wildfire, land", tone: "ok" },
    { label: "Contradiction mode", value: "visible", detail: "satellite conflict cannot be hidden", tone: "watch" },
    { label: "Processing lineage", value: "required", detail: "dataset, timestamp, version, license", tone: "review" },
  ],
  panels: [
    {
      title: "Satellite layers",
      body: "Every tile and scene must carry provider, acquisition time, resolution, processing version, and license.",
      items: ["Sentinel", "Landsat", "NASA", "open climate datasets"],
      tone: "ok",
    },
    {
      title: "Vegetation and water",
      body: "NDVI, vegetation health, water stress, and land-change layers feed verification tasks.",
      items: ["NDVI", "water index", "drought signal", "land-change delta"],
      tone: "review",
    },
    {
      title: "Contradiction handling",
      body: "Satellite contradiction opens a review workflow; it does not silently reject or certify evidence.",
      items: ["scene evidence", "cloud cover", "seasonal exception", "review rationale"],
      tone: "watch",
    },
  ],
  workflow: [
    { label: "Scene ingested", owner: "TerraProof connector", state: "provenance", detail: "Dataset source and acquisition metadata are recorded." },
    { label: "Layer derived", owner: "Verification Agent", state: "advisory", detail: "Indices produce observations, not final decisions." },
    { label: "Evidence compared", owner: "Canopy AI", state: "queued", detail: "Anomaly and contradiction signals become dependency-bound verification work." },
    { label: "Reviewer decides", owner: "Human verifier", state: "final", detail: "Reviewer rationale is written to audit history." },
  ],
};

export const esgReportingEngine: CanopyProofOSModule = {
  route: "/reports/esg",
  layer: "Impact",
  eyebrow: "ESG Reporting Engine",
  title: "Institutional reporting with GRI alignment, SDG mapping, TNFD preparation, and proof lineage.",
  summary:
    "Reports export PDF, JSON, and API-ready records only after lineage validation and human/governance review. They are environmental accountability reports, not offset certificates.",
  primaryAction: "Draft ESG report",
  secondaryAction: "Review lineage",
  metrics: [
    { label: "Export formats", value: "3", detail: "PDF, JSON, API", tone: "ok" },
    { label: "Framework maps", value: "4", detail: "GRI, SDG, TNFD, biodiversity/climate", tone: "review" },
    { label: "Lineage gate", value: "required", detail: "evidence, review, funding, governance", tone: "ok" },
    { label: "Claim boundary", value: "strict", detail: "no offsets, no yield, no automatic rewards", tone: "ok" },
  ],
  panels: [
    {
      title: "GRI and SDG mapping",
      body: "Reports map restoration evidence to institutional frameworks while preserving methodology limits.",
      items: ["GRI narrative", "SDG 6", "SDG 13", "SDG 15"],
      tone: "ok",
    },
    {
      title: "TNFD preparation",
      body: "Nature-related dependencies, risks, data quality, and governance are explicit in the report draft.",
      items: ["location", "risk", "monitoring", "limitations"],
      tone: "review",
    },
    {
      title: "Publication gate",
      body: "AI may draft explanations, but humans and governance approve publication.",
      items: ["lineage check", "human review", "approval", "audit export"],
      tone: "watch",
    },
  ],
  workflow: [
    { label: "Draft", owner: "ESG Agent", state: "advisory", detail: "AI can assemble a report draft with citations." },
    { label: "Lineage check", owner: "Verification Layer", state: "required", detail: "Every metric links to evidence, review, or funding records." },
    { label: "Approve", owner: "Governance Layer", state: "human gated", detail: "Publication requires policy-bound review." },
    { label: "Export", owner: "Impact Layer", state: "audited", detail: "PDF, JSON, and API exports create audit events." },
  ],
};

export const governanceOperatingLayer: CanopyProofOSModule = {
  route: "/governance",
  layer: "Governance",
  eyebrow: "Governance Layer",
  title: "Policy-bound approvals, reviewer accountability, and conflict disclosure before public records.",
  summary:
    "Governance decisions bind to deterministic subjects, authenticated reviewers, conflict disclosures, and append-only audit events before proof, ESG, funding, or public risk actions can become institutional records.",
  primaryAction: "Review governance policies",
  secondaryAction: "Inspect conflict queue",
  metrics: [
    { label: "Default policies", value: "5", detail: "proof, ESG, funding, risk, partner", tone: "ok" },
    { label: "Approval binding", value: "exact", detail: "subject ID from project and evidence root", tone: "ok" },
    { label: "Conflict state", value: "blocking", detail: "unresolved disclosures halt issuance", tone: "review" },
    { label: "Proof challenges", value: "public", detail: "challenged records stop clean exports", tone: "watch" },
    { label: "Authority", value: "human", detail: "AI agents cannot approve final records", tone: "ok" },
  ],
  panels: [
    {
      title: "Policy registry",
      body: "Policies define the subject types, reviewer roles, and approval counts required for institutional actions.",
      items: ["proof issuance", "ESG publication", "funding allocation", "risk release"],
      tone: "ok",
    },
    {
      title: "Approval ledger",
      body: "Approvals inherit reviewer identity from authenticated headers and bind to deterministic subject IDs.",
      items: ["policy ID", "reviewer role", "decision", "rationale"],
      tone: "review",
    },
    {
      title: "Conflict disclosure",
      body: "Open disclosures block proof validation until governance review clears or waives them.",
      items: ["severity", "status", "disclosure hash", "audit event"],
      tone: "watch",
    },
    {
      title: "Proof challenge lane",
      body: "Public proof-record challenges immediately mark records as disputed until accountable review resolves them.",
      items: ["challenger", "reason", "evidence root", "public outcome"],
      tone: "review",
    },
  ],
  workflow: [
    { label: "Subject defined", owner: "Verification Layer", state: "deterministic", detail: "Proof subject ID derives from project and sorted evidence IDs." },
    { label: "Policy selected", owner: "Governance Layer", state: "required", detail: "Policy establishes reviewer roles and approval count." },
    { label: "Conflicts checked", owner: "Reviewer", state: "blocking", detail: "Unresolved disclosures stop validation." },
    { label: "Approval recorded", owner: "Governance Layer", state: "audited", detail: "Approval writes a typed audit event and hash root." },
    { label: "Challenge resolved", owner: "Verifier", state: "public outcome", detail: "Accepted challenges revoke records; rejected challenges restore status only when no blocking challenge remains." },
  ],
};

export const partnerCollaborationLayer: CanopyProofOSModule = {
  route: "/partners",
  layer: "Governance",
  eyebrow: "UN / NGO Collaboration Layer",
  title: "Institutional partner profiles, accreditation, RBAC, and governed data-sharing.",
  summary:
    "Partners operate through organization-scoped roles, explicit accreditation, data-sharing agreements, and auditable membership changes.",
  primaryAction: "Review partner registry",
  secondaryAction: "Inspect RBAC matrix",
  metrics: [
    { label: "Organization types", value: "6", detail: "UN, NGO, university, government, investor, operator", tone: "ok" },
    { label: "RBAC roles", value: "6", detail: "owner, admin, verifier, researcher, community, observer", tone: "ok" },
    { label: "Data access", value: "scoped", detail: "region, project, dataset, purpose", tone: "review" },
    { label: "Suspension", value: "audited", detail: "history retained, access revoked", tone: "watch" },
  ],
  panels: [
    {
      title: "Organization profiles",
      body: "Profiles record jurisdiction, public contact, accreditation, verification capability, and operating regions.",
      items: ["UN agency", "NGO", "university", "government"],
      tone: "ok",
    },
    {
      title: "RBAC matrix",
      body: "Role assignment is least-privilege by default and every membership mutation is audited.",
      items: ["Owner", "Admin", "Verifier", "Researcher", "Community", "Observer"],
      tone: "review",
    },
    {
      title: "Data sharing",
      body: "Research and government access uses explicit agreements, export logs, and privacy-filtered datasets.",
      items: ["agreement", "dataset grant", "export log", "revocation"],
      tone: "watch",
    },
  ],
  workflow: [
    { label: "Apply", owner: "Organization", state: "applicant", detail: "Partner submits profile and due-diligence materials." },
    { label: "Accredit", owner: "Governance Layer", state: "reviewed", detail: "Reviewer checks capabilities, jurisdiction, and conflicts." },
    { label: "Grant roles", owner: "Owner/Admin", state: "scoped", detail: "Membership is organization-scoped and audited." },
    { label: "Collaborate", owner: "Partner", state: "bounded", detail: "Evidence, research, and reports follow policy scope." },
  ],
};

export const fundingTransparencyLayer: CanopyProofOSModule = {
  route: "/funding",
  layer: "Impact",
  eyebrow: "Funding Transparency Layer",
  title: "Open-government style traceability from donor and grant to milestone, evidence, and release.",
  summary:
    "Funding records separate pledged, allocated, approved, released, and reconciled amounts. No release can claim verified impact without accepted evidence and approval.",
  primaryAction: "Open funding ledger",
  secondaryAction: "Inspect milestones",
  metrics: [
    { label: "Ledger states", value: "5", detail: "pledged, allocated, approved, released, reconciled", tone: "ok" },
    { label: "Release gate", value: "evidence", detail: "accepted evidence and approval required", tone: "review" },
    { label: "Public timeline", value: "on", detail: "milestone and audit visibility", tone: "ok" },
    { label: "Financial claims", value: "blocked", detail: "no guaranteed yield or offset promise", tone: "ok" },
  ],
  panels: [
    {
      title: "Donor and grant traceability",
      body: "Funding timelines connect donors, grants, projects, allocations, milestones, and evidence.",
      items: ["donor", "grant", "allocation", "project"],
      tone: "ok",
    },
    {
      title: "Milestone release",
      body: "Release decisions require accepted evidence, reviewer decision, and governance/audit trail.",
      items: ["milestone", "evidence", "approval", "release"],
      tone: "review",
    },
    {
      title: "Transparency boundary",
      body: "Funding records are accountability records, not yield instruments, offsets, or token promises.",
      items: ["public ledger", "claim boundary", "reconciliation", "audit"],
      tone: "watch",
    },
  ],
  workflow: [
    { label: "Grant recorded", owner: "Funding Agent", state: "pledged", detail: "Grant source and purpose enter public transparency model." },
    { label: "Allocation proposed", owner: "Project operator", state: "pending", detail: "Allocation links to project and milestone condition." },
    { label: "Evidence accepted", owner: "Verifier", state: "human gated", detail: "Milestone evidence must be accepted before release." },
    { label: "Release audited", owner: "Governance Layer", state: "append-only", detail: "Release creates funding and audit records." },
  ],
};

export const earlyWarningSystem: CanopyProofOSModule = {
  route: "/risk",
  layer: "Impact",
  eyebrow: "Early Warning System",
  title: "Drought, wildfire, flooding, and ecosystem degradation alerts for communities and institutions.",
  summary:
    "Risk signals combine environmental layers and field evidence, then route alerts to communities, NGOs, governments, project operators, and accredited reviewers.",
  primaryAction: "Open alert board",
  secondaryAction: "Review risk policy",
  metrics: [
    { label: "Risk classes", value: "4", detail: "drought, wildfire, flooding, degradation", tone: "watch" },
    { label: "Alert audiences", value: "5", detail: "community, NGO, government, operator, verifier", tone: "ok" },
    { label: "Escalation", value: "audited", detail: "acknowledgement and escalation events", tone: "review" },
    { label: "Auto claims", value: "blocked", detail: "review required for public emergency assertions", tone: "ok" },
  ],
  panels: [
    {
      title: "Risk monitoring",
      body: "Risk layers track drought, wildfire, flooding, and ecosystem degradation with source provenance.",
      items: ["drought", "wildfire", "flooding", "ecosystem degradation"],
      tone: "watch",
    },
    {
      title: "Alert routing",
      body: "Alerts are scoped by severity, audience, geography, and governance policy.",
      items: ["community", "NGO", "government", "operator"],
      tone: "review",
    },
    {
      title: "Response audit",
      body: "Acknowledgements, escalations, and resolved alerts write auditable records.",
      items: ["acknowledge", "escalate", "resolve", "review"],
      tone: "ok",
    },
  ],
  workflow: [
    { label: "Signal detected", owner: "Risk Agent", state: "watch", detail: "Layer or field evidence raises a risk signal." },
    { label: "Audience scoped", owner: "Governance Layer", state: "policy", detail: "Alert audience is selected by role and geography." },
    { label: "Alert issued", owner: "Impact Layer", state: "bounded", detail: "Public assertions remain reviewed and conservative." },
    { label: "Response tracked", owner: "Community/NGO/Government", state: "audited", detail: "Acknowledgement and escalation are logged." },
  ],
};

export const canopyProofOsModules = [
  globalImpactCommandCenter,
  mobileEvidenceNetwork,
  terraProofIntelligence,
  esgReportingEngine,
  governanceOperatingLayer,
  partnerCollaborationLayer,
  fundingTransparencyLayer,
  earlyWarningSystem,
] as const;
