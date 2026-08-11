import { hashJson, merkleRoot } from "@dropin/crypto";

export const canopyProofEvidenceStatuses = [
  "submitted",
  "validated",
  "ai_analyzed",
  "needs_human_review",
  "accepted",
  "rejected",
  "challenged",
  "superseded",
] as const;

export const canopyProofEvidenceTypes = [
  "tree_planting",
  "restoration",
  "biodiversity",
  "water_project",
  "soil_regeneration",
  "climate_observation",
] as const;

export const canopyAiCapabilities = [
  "satellite comparison",
  "anomaly detection",
  "duplicate detection",
  "fraud detection",
  "ecological reasoning",
  "survival estimation",
] as const;

export type CanopyProofEvidenceStatus = (typeof canopyProofEvidenceStatuses)[number];
export type CanopyProofEvidenceType = (typeof canopyProofEvidenceTypes)[number];
export type CanopyAiCapability = (typeof canopyAiCapabilities)[number];
export type CanopyProofRiskLevel = "low" | "medium" | "high" | "critical";
export type CanopyProofAhinAction = "ASSERT" | "REASON" | "DELEGATE" | "FULFILL" | "CHALLENGE";

export const canopyProofAuditEntityTypes = [
  "project",
  "project_status_transition",
  "project_monitoring_event",
  "project_lifecycle_registration",
  "project_lifecycle_review",
  "project_lifecycle_transition",
  "project_lifecycle_control",
  "evidence",
  "validation_run",
  "ai_analysis",
  "human_review",
  "evidence_challenge",
  "evidence_challenge_resolution",
  "evidence_correction",
  "evidence_final_decision",
  "governed_policy_authority",
  "methodology_publication_approval",
  "methodology_publication",
  "environmental_proof_candidate",
  "environmental_proof_candidate_approval",
  "environmental_proof_record",
  "environmental_proof_challenge",
  "environmental_proof_challenge_risk",
  "environmental_proof_challenge_review",
  "environmental_proof_challenge_resolution",
  "verification_decision",
  "verification_work_item",
  "proof_record",
  "esg_report",
  "esg_metric_definition",
  "esg_metric_result",
  "global_command_center_snapshot",
  "global_command_center_spatial_review",
  "global_command_center_spatial_disclosure",
  "public_disclosure_review",
  "public_transparency_publication",
  "institutional_report_package",
  "investor_review_package",
  "terra_scene",
  "nasa_gibs_catalog_snapshot",
  "nasa_gibs_sync_failure",
  "nasa_gibs_map_manifest",
  "nasa_gibs_observation_comparison",
  "nasa_gibs_source_handoff",
  "nasa_gibs_event_watch",
  "visual_acquisition_mission",
  "visual_sensor_stream",
  "visual_dataset",
  "visual_dataset_snapshot",
  "visual_media_asset",
  "visual_point_cloud_asset",
  "visual_derived_asset",
  "visual_model_definition",
  "visual_model_run",
  "visual_embedding_index",
  "visual_candidate",
  "visual_review_queue",
  "visual_review_queue_snapshot",
  "visual_review_decision",
  "visual_field_verification_task",
  "visual_field_verification_result",
  "visual_hard_negative",
  "visual_known_decoy",
  "visual_sensor_domain_gap",
  "visual_finding",
  "visual_provenance_edge",
  "identity_participant",
  "identity_reputation_snapshot",
  "organization",
  "organization_verification",
  "organization_lifecycle",
  "organization_document_review",
  "organization_appeal",
  "organization_appeal_decision",
  "organization_accreditation_application",
  "organization_accreditation_review",
  "organization_accreditation_decision",
  "organization_accreditation_control",
  "root_governance_proposal",
  "root_governance_attestation",
  "root_governance_decision",
  "membership",
  "accreditation",
  "data_sharing_agreement",
  "data_sharing_agreement_revocation",
  "data_sharing_agreement_supersession",
  "data_access_request",
  "data_access_request_decision",
  "data_access_delivery_receipt",
  "data_use_attestation",
  "data_use_enforcement_case",
  "data_access_restriction",
  "data_access_accountability_packet",
  "data_access_accountability_verification",
  "data_access_accountability_disclosure",
  "data_access_accountability_disclosure_challenge",
  "data_access_accountability_disclosure_resolution",
  "data_access_accountability_disclosure_notice",
  "funding_source",
  "funding_allocation",
  "funding_milestone",
  "funding_evidence_link",
  "funding_accountability_review",
  "funding_accountability_publication",
  "media_upload_intent",
  "media_object",
  "media_provider_receipt_verification",
  "media_duplicate_relation",
  "media_scan_result",
  "media_scanner_receipt_verification",
  "evidence_media_review_task",
  "evidence_media_review_assignment",
  "evidence_media_review_decision",
  "evidence_media_custody_event",
  "evidence_media_retention_execution",
  "consent_receipt",
  "consent_revocation",
  "device_attestation",
  "media_metadata_extraction",
  "metadata_extraction_request",
  "metadata_extraction_receipt_verification",
  "evidence_review_task",
  "retention_policy_decision",
  "evidence_sync_batch",
  "community_attestation",
  "evidence_custody_event",
  "risk_layer",
  "risk_signal",
  "risk_alert",
  "risk_response",
  "risk_alert_dispatch",
  "risk_response_playbook",
  "risk_response_activation",
  "risk_response_closure",
  "risk_after_action_review",
  "methodology",
  "canopyproof_agent",
  "agent_event",
  "memory_record",
  "access_decision",
  "audit_verification",
  "audit_attestation",
  "audit_export_manifest",
  "quality_scorecard",
  "security_policy",
  "abuse_signal",
  "governance_policy",
  "governance_approval",
  "conflict_disclosure",
  "proof_record_challenge",
  "challenge_case",
  "certificate_transparency_entry",
  "certificate_verification",
  "mrv_graph_edge",
  "mrv_graph_snapshot",
  "environmental_proof_signing_key_attestation",
  "environmental_proof_signing_key_revocation",
  "environmental_proof_lifecycle_binding",
  "environmental_proof_signature_receipt",
  "environmental_proof_lifecycle_control",
  "resilience_drill",
] as const;

export type CanopyProofAuditEntityType = (typeof canopyProofAuditEntityTypes)[number];

export type CanopyProofLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters?: number;
  readonly regionId?: string;
};

export type CanopyProofAuditEvent = {
  readonly id: string;
  readonly action: CanopyProofAhinAction;
  readonly actor: string;
  readonly entityType: CanopyProofAuditEntityType;
  readonly entityId: string;
  readonly previousRoot: string;
  readonly payloadHash: string;
  readonly eventRoot: string;
  readonly createdAt: string;
  readonly rationale: string;
};

export type CanopyProofAuditVerificationEntry = {
  readonly event: CanopyProofAuditEvent;
  readonly payload?: unknown;
};

export type CanopyProofAuditVerificationIssue = {
  readonly code:
    | "empty_audit_chain"
    | "duplicate_event_id"
    | "invalid_event_id"
    | "invalid_previous_root"
    | "invalid_payload_hash"
    | "invalid_event_root"
    | "missing_actor"
    | "missing_rationale"
    | "non_monotonic_created_at";
  readonly eventId?: string;
  readonly index?: number;
  readonly expected?: string;
  readonly actual?: string;
};

export type CanopyProofAuditChainVerification = {
  readonly valid: boolean;
  readonly eventCount: number;
  readonly firstRoot: string;
  readonly terminalRoot: string;
  readonly chainRoot: string;
  readonly verifiedAt: string;
  readonly issues: readonly CanopyProofAuditVerificationIssue[];
  readonly safety: {
    readonly eventRootsRecomputed: true;
    readonly previousRootsLinked: true;
    readonly duplicateIdsRejected: true;
    readonly payloadHashesCheckedWhenProvided: true;
  };
};

export type CanopyProofEvidenceEnvelope = {
  readonly id: string;
  readonly projectId: string;
  readonly evidenceType: CanopyProofEvidenceType;
  readonly location: CanopyProofLocation;
  readonly timestamp: string;
  readonly contributor: string;
  readonly media_hash: string;
  readonly gps_hash: string;
  readonly verification_status: CanopyProofEvidenceStatus;
  readonly confidence_score: number;
  readonly reviewers: readonly string[];
  readonly audit_history: readonly CanopyProofAuditEvent[];
  readonly offline_sync_id?: string;
  readonly device_fingerprint_hash?: string;
  readonly exif_hash?: string;
};

export type CanopyAiFinding = {
  readonly id: string;
  readonly capability: CanopyAiCapability;
  readonly severity: CanopyProofRiskLevel;
  readonly code: string;
  readonly message: string;
  readonly recommendedAction: CanopyProofAhinAction;
};

export type CanopyAiAnalysis = {
  readonly id: string;
  readonly evidenceId: string;
  readonly modelVersion: string;
  readonly advisoryOnly: true;
  readonly capabilities: readonly CanopyAiCapability[];
  readonly findings: readonly CanopyAiFinding[];
  readonly recommendedStatus: "needs_human_review" | "rejected";
  readonly confidence_score: number;
  readonly audit_event: CanopyProofAuditEvent;
};

export type CanopyHumanReview = {
  readonly reviewer: string;
  readonly role: "verifier" | "ngo" | "government" | "un_agency" | "researcher";
  readonly decision: "approve" | "reject" | "challenge";
  readonly rationale: string;
  readonly reviewedAt: string;
  readonly acceptedFindingIds?: readonly string[];
};

export type EnvironmentalProofRecord = {
  readonly id: string;
  readonly recordType: "environmental_proof_record";
  readonly projectId: string;
  readonly location: CanopyProofLocation;
  readonly evidenceRoot: string;
  readonly evidenceIds: readonly string[];
  readonly verificationHistory: readonly CanopyProofAuditEvent[];
  readonly monitoringTimeline: readonly string[];
  readonly monitoringEventIds: readonly string[];
  readonly contributors: readonly string[];
  readonly governanceApprovals: readonly string[];
  readonly confidence_score: number;
  readonly status: "issued" | "challenged" | "revoked";
  readonly issuedAt: string;
  readonly recordHash: string;
  readonly claimBoundary: {
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
    readonly notAutomaticCanopyDistribution: true;
    readonly disclosure: string;
  };
};

export type BuildCanopyAiAnalysisInput = {
  readonly evidence: CanopyProofEvidenceEnvelope;
  readonly modelVersion?: string;
  readonly observedAt?: string;
  readonly knownMediaHashes?: readonly string[];
  readonly expectedLocation?: CanopyProofLocation;
  readonly satelliteObservation?: {
    readonly vegetationSignal: "supports" | "neutral" | "contradicts";
    readonly waterSignal?: "supports" | "neutral" | "contradicts";
    readonly acquiredAt: string;
  };
  readonly ecologicalObservation?: {
    readonly biodiversitySignal?: "supports" | "neutral" | "contradicts";
    readonly soilMoistureSignal?: "supports" | "neutral" | "contradicts";
    readonly disturbanceSignal?: "none" | "minor" | "major";
    readonly observedAt: string;
  };
  readonly survivalObservation?: {
    readonly survivalSignal: "supports" | "neutral" | "contradicts";
    readonly estimatedSurvivalPercent?: number;
    readonly mortalityPercent?: number;
    readonly observedAt: string;
    readonly method?: "field_count" | "photo_plot" | "satellite_proxy" | "sensor_estimate";
  };
};

export type IssueEnvironmentalProofRecordInput = {
  readonly projectId: string;
  readonly evidence: readonly CanopyProofEvidenceEnvelope[];
  readonly aiAnalyses: readonly CanopyAiAnalysis[];
  readonly humanReview: CanopyHumanReview;
  readonly governanceApprovals: readonly string[];
  readonly monitoringTimeline: readonly string[];
  readonly monitoringEventIds?: readonly string[];
  readonly issuedAt?: string;
};

const GENESIS_AUDIT_ROOT = hashJson({ kind: "canopyproof-audit-genesis-v1" });

export function canopyProofAuditGenesisRoot() {
  return GENESIS_AUDIT_ROOT;
}

export function appendCanopyProofAuditEvent(
  history: readonly CanopyProofAuditEvent[],
  input: Readonly<{
    action: CanopyProofAhinAction;
    actor: string;
    entityType: CanopyProofAuditEvent["entityType"];
    entityId: string;
    payload: unknown;
    createdAt?: string;
    rationale: string;
  }>,
): readonly CanopyProofAuditEvent[] {
  if (!input.actor.trim()) {
    throw new Error("CanopyProof audit event requires an accountable actor.");
  }
  if (!input.rationale.trim()) {
    throw new Error("CanopyProof audit event requires rationale.");
  }

  const previousRoot = history.at(-1)?.eventRoot ?? GENESIS_AUDIT_ROOT;
  const createdAt = input.createdAt ?? new Date(0).toISOString();
  const payloadHash = hashJson(input.payload);
  const eventSeed = {
    action: input.action,
    actor: input.actor,
    entityType: input.entityType,
    entityId: input.entityId,
    previousRoot,
    payloadHash,
    createdAt,
    rationale: input.rationale,
  };
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...eventSeed });
  const event: CanopyProofAuditEvent = {
    id: `cp_audit_${eventRoot.slice(0, 24)}`,
    ...eventSeed,
    eventRoot,
  };
  return [...history, event];
}

export function verifyCanopyProofAuditChain(
  entries: readonly (CanopyProofAuditEvent | CanopyProofAuditVerificationEntry)[],
  verifiedAt = new Date(0).toISOString(),
): CanopyProofAuditChainVerification {
  const normalized = entries.map((entry) => ("event" in entry ? entry : { event: entry }));
  const issues: CanopyProofAuditVerificationIssue[] = [];
  const seenEventIds = new Set<string>();
  let previousRoot = GENESIS_AUDIT_ROOT;
  let previousCreatedAtMs: number | undefined;

  if (normalized.length === 0) {
    issues.push({ code: "empty_audit_chain" });
  }

  for (const [index, entry] of normalized.entries()) {
    const event = entry.event;
    if (seenEventIds.has(event.id)) {
      issues.push({ code: "duplicate_event_id", eventId: event.id, index });
    }
    seenEventIds.add(event.id);

    if (!event.actor.trim()) {
      issues.push({ code: "missing_actor", eventId: event.id, index });
    }
    if (!event.rationale.trim()) {
      issues.push({ code: "missing_rationale", eventId: event.id, index });
    }
    if (event.previousRoot !== previousRoot) {
      issues.push({ code: "invalid_previous_root", eventId: event.id, index, expected: previousRoot, actual: event.previousRoot });
    }

    if (entry.payload !== undefined) {
      const expectedPayloadHash = hashJson(entry.payload);
      if (event.payloadHash !== expectedPayloadHash) {
        issues.push({ code: "invalid_payload_hash", eventId: event.id, index, expected: expectedPayloadHash, actual: event.payloadHash });
      }
    }

    const expectedEventRoot = hashJson({
      kind: "canopyproof-audit-event-v1",
      action: event.action,
      actor: event.actor,
      entityType: event.entityType,
      entityId: event.entityId,
      previousRoot: event.previousRoot,
      payloadHash: event.payloadHash,
      createdAt: event.createdAt,
      rationale: event.rationale,
    });
    if (event.eventRoot !== expectedEventRoot) {
      issues.push({ code: "invalid_event_root", eventId: event.id, index, expected: expectedEventRoot, actual: event.eventRoot });
    }

    const expectedEventId = `cp_audit_${expectedEventRoot.slice(0, 24)}`;
    if (event.id !== expectedEventId) {
      issues.push({ code: "invalid_event_id", eventId: event.id, index, expected: expectedEventId, actual: event.id });
    }

    const createdAtMs = Date.parse(event.createdAt);
    if (previousCreatedAtMs !== undefined && Number.isFinite(createdAtMs) && createdAtMs < previousCreatedAtMs) {
      issues.push({ code: "non_monotonic_created_at", eventId: event.id, index });
    }
    if (Number.isFinite(createdAtMs)) {
      previousCreatedAtMs = createdAtMs;
    }
    previousRoot = event.eventRoot;
  }

  const firstRoot = normalized.at(0)?.event.eventRoot ?? GENESIS_AUDIT_ROOT;
  const terminalRoot = normalized.at(-1)?.event.eventRoot ?? GENESIS_AUDIT_ROOT;
  return {
    valid: issues.length === 0,
    eventCount: normalized.length,
    firstRoot,
    terminalRoot,
    chainRoot: hashJson({
      kind: "canopyproof-audit-chain-verification-v1",
      eventRoots: normalized.map((entry) => entry.event.eventRoot),
      terminalRoot,
      issueCodes: issues.map((issue) => issue.code),
      verifiedAt,
    }),
    verifiedAt,
    issues,
    safety: {
      eventRootsRecomputed: true,
      previousRootsLinked: true,
      duplicateIdsRejected: true,
      payloadHashesCheckedWhenProvided: true,
    },
  };
}

export function validateCanopyProofEvidenceEnvelope(evidence: CanopyProofEvidenceEnvelope): readonly string[] {
  const issues: string[] = [];

  if (!evidence.id.trim()) issues.push("missing_id");
  if (!evidence.projectId.trim()) issues.push("missing_project_id");
  if (!evidence.contributor.trim() || evidence.contributor.toLowerCase().includes("anonymous")) {
    issues.push("unaccountable_contributor");
  }
  if (!isSha256Like(evidence.media_hash)) issues.push("invalid_media_hash");
  if (!isSha256Like(evidence.gps_hash)) issues.push("invalid_gps_hash");
  if (!Number.isFinite(evidence.location.latitude) || evidence.location.latitude < -90 || evidence.location.latitude > 90) {
    issues.push("invalid_latitude");
  }
  if (!Number.isFinite(evidence.location.longitude) || evidence.location.longitude < -180 || evidence.location.longitude > 180) {
    issues.push("invalid_longitude");
  }
  if (evidence.location.accuracyMeters !== undefined && evidence.location.accuracyMeters > 100) {
    issues.push("gps_accuracy_too_weak");
  }
  if (!Number.isFinite(Date.parse(evidence.timestamp))) issues.push("invalid_timestamp");
  if (evidence.confidence_score < 0 || evidence.confidence_score > 100) issues.push("invalid_confidence_score");
  if (evidence.audit_history.length === 0) issues.push("missing_append_only_audit_history");

  return issues;
}

export function buildCanopyAiAnalysis(input: BuildCanopyAiAnalysisInput): CanopyAiAnalysis {
  const modelVersion = input.modelVersion ?? "canopy-ai-policy-v1";
  const observedAt = input.observedAt ?? new Date(0).toISOString();
  const findings: CanopyAiFinding[] = [];
  const evidenceIssues = validateCanopyProofEvidenceEnvelope(input.evidence);

  for (const issue of evidenceIssues) {
    findings.push(finding(input.evidence.id, "fraud detection", "high", issue, `Evidence envelope failed validation: ${issue}.`, "CHALLENGE"));
  }

  if (input.knownMediaHashes?.includes(input.evidence.media_hash)) {
    findings.push(
      finding(
        input.evidence.id,
        "duplicate detection",
        "critical",
        "duplicate_media_hash",
        "The media hash already exists in the evidence corpus and must be challenged before proof issuance.",
        "CHALLENGE",
      ),
    );
  }

  if (input.expectedLocation && approximateDistanceMeters(input.expectedLocation, input.evidence.location) > 250) {
    findings.push(
      finding(
        input.evidence.id,
        "anomaly detection",
        "critical",
        "gps_spoofing_suspected",
        "Evidence location is outside the expected operating envelope for the project.",
        "CHALLENGE",
      ),
    );
  }

  if (
    input.satelliteObservation?.vegetationSignal === "contradicts" ||
    input.satelliteObservation?.waterSignal === "contradicts"
  ) {
    findings.push(
      finding(
        input.evidence.id,
        "satellite comparison",
        "critical",
        "satellite_contradiction",
        "Satellite observation contradicts the submitted field evidence and requires human review.",
        "CHALLENGE",
      ),
    );
  }

  if (
    input.ecologicalObservation?.biodiversitySignal === "contradicts" ||
    input.ecologicalObservation?.soilMoistureSignal === "contradicts" ||
    input.ecologicalObservation?.disturbanceSignal === "major"
  ) {
    findings.push(
      finding(
        input.evidence.id,
        "ecological reasoning",
        "high",
        "ecological_context_risk",
        "Ecological context indicates biodiversity, soil-moisture, or disturbance risk that must be reviewed before relying on the claim.",
        "CHALLENGE",
      ),
    );
  } else if (input.ecologicalObservation?.disturbanceSignal === "minor") {
    findings.push(
      finding(
        input.evidence.id,
        "ecological reasoning",
        "medium",
        "ecological_monitoring_required",
        "Ecological context shows minor disturbance and should be monitored during human review.",
        "DELEGATE",
      ),
    );
  }

  const survival = input.survivalObservation;
  if (
    survival?.survivalSignal === "contradicts" ||
    (survival?.estimatedSurvivalPercent !== undefined && survival.estimatedSurvivalPercent < 60) ||
    (survival?.mortalityPercent !== undefined && survival.mortalityPercent > 40)
  ) {
    findings.push(
      finding(
        input.evidence.id,
        "survival estimation",
        "critical",
        "survival_estimation_contradiction",
        "Survival evidence contradicts the restoration claim or indicates survival below the minimum institutional review threshold.",
        "CHALLENGE",
      ),
    );
  } else if (
    survival &&
    ((survival.estimatedSurvivalPercent !== undefined && survival.estimatedSurvivalPercent < 75) ||
      (survival.mortalityPercent !== undefined && survival.mortalityPercent > 25))
  ) {
    findings.push(
      finding(
        input.evidence.id,
        "survival estimation",
        "high",
        "survival_estimation_risk",
        "Survival evidence is within a caution band and requires human review plus continued monitoring.",
        "DELEGATE",
      ),
    );
  }

  const riskPenalty = findings.reduce((sum, item) => sum + severityPenalty(item.severity), 0);
  const confidence_score = clampScore(input.evidence.confidence_score - riskPenalty);
  const recommendedStatus = findings.some((item) => item.severity === "critical") ? "rejected" : "needs_human_review";
  const payload = {
    evidenceId: input.evidence.id,
    modelVersion,
    findings,
    recommendedStatus,
    confidence_score,
    advisoryOnly: true,
  };
  const auditHistory = appendCanopyProofAuditEvent(input.evidence.audit_history, {
    action: "REASON",
    actor: "Canopy AI Agent",
    entityType: "ai_analysis",
    entityId: input.evidence.id,
    payload,
    createdAt: observedAt,
    rationale: "AI advisory analysis created; it cannot finalize proof status.",
  });
  const audit_event = auditHistory.at(-1);
  if (!audit_event) {
    throw new Error("CanopyProof AI analysis failed to create an audit event.");
  }

  return {
    id: `cp_ai_${hashJson(payload).slice(0, 24)}`,
    evidenceId: input.evidence.id,
    modelVersion,
    advisoryOnly: true,
    capabilities: canopyAiCapabilities,
    findings,
    recommendedStatus,
    confidence_score,
    audit_event,
  };
}

export function issueEnvironmentalProofRecord(input: IssueEnvironmentalProofRecordInput): EnvironmentalProofRecord {
  if (input.evidence.length === 0) {
    throw new Error("Environmental proof record requires evidence.");
  }
  if (input.humanReview.decision !== "approve") {
    throw new Error("HUMAN_REVIEW_REQUIRED: proof records require approving human review.");
  }
  if (!input.humanReview.rationale.trim()) {
    throw new Error("Human review rationale is required.");
  }
  if (input.governanceApprovals.length === 0) {
    throw new Error("Governance approval is required before public proof issuance.");
  }
  if (input.monitoringTimeline.length === 0) {
    throw new Error("Monitoring timeline is required before public proof issuance.");
  }

  const invalidEvidence = input.evidence.flatMap((evidence) =>
    validateCanopyProofEvidenceEnvelope(evidence).map((issue) => `${evidence.id}:${issue}`),
  );
  if (invalidEvidence.length > 0) {
    throw new Error(`Invalid CanopyProof evidence: ${invalidEvidence.join(",")}`);
  }

  const evidenceIds = input.evidence.map((evidence) => evidence.id).sort();
  const aiByEvidence = new Map(input.aiAnalyses.map((analysis) => [analysis.evidenceId, analysis]));
  const missingAi = evidenceIds.filter((evidenceId) => !aiByEvidence.has(evidenceId));
  if (missingAi.length > 0) {
    throw new Error(`AI advisory analysis is required before human review: ${missingAi.join(",")}`);
  }

  const criticalFindings = input.aiAnalyses.flatMap((analysis) =>
    analysis.findings.filter((finding) => finding.severity === "critical").map((finding) => finding.id),
  );
  const acceptedFindings = new Set(input.humanReview.acceptedFindingIds ?? []);
  const unresolvedCritical = criticalFindings.filter((findingId) => !acceptedFindings.has(findingId));
  if (unresolvedCritical.length > 0) {
    throw new Error(`Critical AI findings must be explicitly resolved before proof issuance: ${unresolvedCritical.join(",")}`);
  }

  const issuedAt = input.issuedAt ?? new Date(0).toISOString();
  const evidenceRoot = merkleRoot(
    input.evidence
      .map((evidence) =>
        hashJson({
          id: evidence.id,
          media_hash: evidence.media_hash,
          gps_hash: evidence.gps_hash,
          timestamp: evidence.timestamp,
          contributor: evidence.contributor,
        }),
      )
      .sort(),
  );
  const contributors = [...new Set(input.evidence.map((evidence) => evidence.contributor))].sort();
  const confidence_score = Math.min(
    ...input.evidence.map((evidence) => evidence.confidence_score),
    ...input.aiAnalyses.map((analysis) => analysis.confidence_score),
  );
  const humanReviewEventHistory = appendCanopyProofAuditEvent(
    input.evidence.flatMap((evidence) => evidence.audit_history),
    {
      action: "FULFILL",
      actor: input.humanReview.reviewer,
      entityType: "human_review",
      entityId: input.projectId,
      payload: input.humanReview,
      createdAt: input.humanReview.reviewedAt,
      rationale: input.humanReview.rationale,
    },
  );
  const proofPayload = {
    projectId: input.projectId,
    evidenceRoot,
    evidenceIds,
    monitoringTimeline: input.monitoringTimeline,
    monitoringEventIds: [...new Set(input.monitoringEventIds ?? [])].sort(),
    governanceApprovals: input.governanceApprovals,
    issuedAt,
  };
  const verificationHistory = appendCanopyProofAuditEvent(
    [...humanReviewEventHistory, ...input.aiAnalyses.map((analysis) => analysis.audit_event)],
    {
      action: "FULFILL",
      actor: "CanopyProof Governance Layer",
      entityType: "proof_record",
      entityId: input.projectId,
      payload: proofPayload,
      createdAt: issuedAt,
      rationale: "Environmental Proof Record issued after evidence, AI advisory analysis, human review, and governance approval.",
    },
  );
  const id = `cp_record_${hashJson(proofPayload).slice(0, 24)}`;
  const recordBase = {
    id,
    recordType: "environmental_proof_record" as const,
    projectId: input.projectId,
    location: input.evidence[0]?.location ?? { latitude: 0, longitude: 0 },
    evidenceRoot,
    evidenceIds,
    verificationHistory,
    monitoringTimeline: input.monitoringTimeline,
    monitoringEventIds: [...new Set(input.monitoringEventIds ?? [])].sort(),
    contributors,
    governanceApprovals: input.governanceApprovals,
    confidence_score,
    status: "issued" as const,
    issuedAt,
    claimBoundary: environmentalProofClaimBoundary(),
  };

  return {
    ...recordBase,
    recordHash: hashJson(recordBase),
  };
}

export function environmentalProofClaimBoundary(): EnvironmentalProofRecord["claimBoundary"] {
  return {
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
    notAutomaticCanopyDistribution: true,
    disclosure:
      "This record is an Environmental Proof Record. It is not a certified carbon credit, financial asset, carbon-tax offset, guaranteed yield instrument, or automatic CANOPY distribution claim.",
  };
}

function finding(
  evidenceId: string,
  capability: CanopyAiCapability,
  severity: CanopyProofRiskLevel,
  code: string,
  message: string,
  recommendedAction: CanopyProofAhinAction,
): CanopyAiFinding {
  return {
    id: `cp_finding_${hashJson({ evidenceId, capability, severity, code, message }).slice(0, 24)}`,
    capability,
    severity,
    code,
    message,
    recommendedAction,
  };
}

function isSha256Like(value: string) {
  return /^(sha256:)?[a-f0-9]{64}$/i.test(value);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityPenalty(severity: CanopyProofRiskLevel) {
  if (severity === "critical") return 60;
  if (severity === "high") return 35;
  if (severity === "medium") return 15;
  return 5;
}

function approximateDistanceMeters(left: CanopyProofLocation, right: CanopyProofLocation) {
  const meanLatitudeRadians = ((left.latitude + right.latitude) / 2) * (Math.PI / 180);
  const metersPerLatitudeDegree = 111_320;
  const metersPerLongitudeDegree = Math.cos(meanLatitudeRadians) * metersPerLatitudeDegree;
  const dy = (left.latitude - right.latitude) * metersPerLatitudeDegree;
  const dx = (left.longitude - right.longitude) * metersPerLongitudeDegree;
  return Math.sqrt(dx * dx + dy * dy);
}
