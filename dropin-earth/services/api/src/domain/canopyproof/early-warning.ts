import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent, type CanopyProofRiskLevel } from "./proof-engine.js";

export const canopyProofRiskClasses = ["drought", "wildfire", "flooding", "ecosystem_degradation"] as const;
export const canopyProofAlertAudiences = ["community", "ngo", "government", "operator", "verifier"] as const;
export const canopyProofAlertStatuses = ["watch", "review_required", "acknowledged", "escalated", "resolved", "challenged"] as const;
export const canopyProofAlertDispatchChannels = ["dashboard", "email", "sms", "webhook", "field_ops", "partner_api"] as const;
export const canopyProofAlertDispatchStatuses = ["queued", "delivered", "failed", "acknowledged"] as const;
export const canopyProofRiskResponsePlaybookActionTypes = [
  "field_assessment",
  "community_briefing",
  "water_stress_check",
  "fire_watch",
  "flood_watch",
  "ecosystem_survey",
  "satellite_review",
  "government_coordination",
  "partner_resource_coordination",
] as const;
export const canopyProofRiskResponseActivationStatuses = ["opened", "in_progress", "completed", "challenged"] as const;
export const canopyProofRiskResponseClosureDecisions = ["complete", "challenge"] as const;
export const canopyProofRiskResponseClosureReviewerRoles = ["owner", "admin", "verifier", "researcher", "community"] as const;
export const canopyProofRiskAfterActionReviewOutcomes = ["accepted", "needs_follow_up", "escalated_to_governance"] as const;
export const canopyProofRiskAfterActionReviewReviewerRoles = ["owner", "admin", "verifier", "researcher"] as const;

export type CanopyProofRiskClass = (typeof canopyProofRiskClasses)[number];
export type CanopyProofAlertAudience = (typeof canopyProofAlertAudiences)[number];
export type CanopyProofAlertStatus = (typeof canopyProofAlertStatuses)[number];
export type CanopyProofAlertDispatchChannel = (typeof canopyProofAlertDispatchChannels)[number];
export type CanopyProofAlertDispatchStatus = (typeof canopyProofAlertDispatchStatuses)[number];
export type CanopyProofRiskResponsePlaybookActionType = (typeof canopyProofRiskResponsePlaybookActionTypes)[number];
export type CanopyProofRiskResponseActivationStatus = (typeof canopyProofRiskResponseActivationStatuses)[number];
export type CanopyProofRiskResponseClosureDecision = (typeof canopyProofRiskResponseClosureDecisions)[number];
export type CanopyProofRiskResponseClosureReviewerRole = (typeof canopyProofRiskResponseClosureReviewerRoles)[number];
export type CanopyProofRiskAfterActionReviewOutcome = (typeof canopyProofRiskAfterActionReviewOutcomes)[number];
export type CanopyProofRiskAfterActionReviewReviewerRole = (typeof canopyProofRiskAfterActionReviewReviewerRoles)[number];

export type CanopyProofRiskLayer = {
  readonly id: string;
  readonly riskClass: CanopyProofRiskClass;
  readonly title: string;
  readonly description: string;
  readonly sourceFamilies: readonly ("terra" | "field_evidence" | "community" | "open_climate")[];
  readonly indicatorKeys: readonly string[];
  readonly updateCadence: "hourly" | "daily" | "weekly";
  readonly thresholds: {
    readonly watch: number;
    readonly high: number;
    readonly critical: number;
  };
  readonly layerHash: string;
};

export type CanopyProofRiskSignal = {
  readonly id: string;
  readonly riskClass: CanopyProofRiskClass;
  readonly regionId: string;
  readonly projectId?: string;
  readonly sourceType: "terra_scene" | "field_evidence" | "community_report" | "open_climate";
  readonly sourceId: string;
  readonly observedAt: string;
  readonly indicators: Readonly<Record<string, number>>;
  readonly confidenceScore: number;
  readonly severity: CanopyProofRiskLevel;
  readonly summary: string;
  readonly recommendedAudience: readonly CanopyProofAlertAudience[];
  readonly signalHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRiskAlert = {
  readonly id: string;
  readonly riskClass: CanopyProofRiskClass;
  readonly regionId: string;
  readonly projectId?: string;
  readonly severity: CanopyProofRiskLevel;
  readonly status: CanopyProofAlertStatus;
  readonly audience: readonly CanopyProofAlertAudience[];
  readonly signalIds: readonly string[];
  readonly summary: string;
  readonly publicMessage?: string;
  readonly publicRelease: {
    readonly allowed: boolean;
    readonly reviewedBy?: string;
    readonly reviewedAt?: string;
    readonly governancePolicyId?: string;
    readonly rationale: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly alertHash: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofRiskResponse = {
  readonly id: string;
  readonly alertId: string;
  readonly responseType: "acknowledge" | "escalate";
  readonly actorId: string;
  readonly audience: readonly CanopyProofAlertAudience[];
  readonly note: string;
  readonly createdAt: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRiskAlertDispatchReceipt = {
  readonly id: string;
  readonly alertId: string;
  readonly riskClass: CanopyProofRiskClass;
  readonly regionId: string;
  readonly projectId?: string;
  readonly recipientAudience: CanopyProofAlertAudience;
  readonly recipientId: string;
  readonly organizationId?: string;
  readonly regionScope?: string;
  readonly channel: CanopyProofAlertDispatchChannel;
  readonly deliveryStatus: CanopyProofAlertDispatchStatus;
  readonly messageHash: string;
  readonly policyId?: string;
  readonly deliveryRoot: string;
  readonly dispatchHash: string;
  readonly dispatchedBy: string;
  readonly dispatchedAt: string;
  readonly deliveredAt?: string;
  readonly safety: {
    readonly noPrivateContactData: true;
    readonly audienceScoped: true;
    readonly noAutomatedEmergencyClaim: true;
    readonly humanReviewRequiredForPublicRelease: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRiskResponsePlaybookStep = {
  readonly id: string;
  readonly actionType: CanopyProofRiskResponsePlaybookActionType;
  readonly title: string;
  readonly accountableAudience: readonly CanopyProofAlertAudience[];
  readonly requiredEvidenceTypes: readonly string[];
  readonly completionCriteria: readonly string[];
};

export type CanopyProofRiskResponsePlaybook = {
  readonly id: string;
  readonly riskClass: CanopyProofRiskClass;
  readonly severityFloor: CanopyProofRiskLevel;
  readonly audience: readonly CanopyProofAlertAudience[];
  readonly requiredDispatchAudience: readonly CanopyProofAlertAudience[];
  readonly title: string;
  readonly objective: string;
  readonly responseWindowHours: number;
  readonly governancePolicyId: string;
  readonly steps: readonly CanopyProofRiskResponsePlaybookStep[];
  readonly safety: {
    readonly operationalOnly: true;
    readonly notEmergencyDeclaration: true;
    readonly humanAuthorityRequired: true;
    readonly evidenceRequiredForClosure: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
  };
  readonly createdAt: string;
  readonly playbookHash: string;
};

export type CanopyProofRiskResponseActivation = {
  readonly id: string;
  readonly alertId: string;
  readonly playbookId: string;
  readonly riskClass: CanopyProofRiskClass;
  readonly severity: CanopyProofRiskLevel;
  readonly dispatchReceiptIds: readonly string[];
  readonly assignedAudience: readonly CanopyProofAlertAudience[];
  readonly assignedOrganizationIds: readonly string[];
  readonly status: CanopyProofRiskResponseActivationStatus;
  readonly dueAt: string;
  readonly evidenceIds: readonly string[];
  readonly note: string;
  readonly activatedBy: string;
  readonly activatedAt: string;
  readonly activationRoot: string;
  readonly activationHash: string;
  readonly safety: CanopyProofRiskResponsePlaybook["safety"] & {
    readonly aiCannotClosePlaybook: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRiskResponseClosure = {
  readonly id: string;
  readonly activationId: string;
  readonly alertId: string;
  readonly playbookId: string;
  readonly decision: CanopyProofRiskResponseClosureDecision;
  readonly reviewerId: string;
  readonly reviewerRole: CanopyProofRiskResponseClosureReviewerRole;
  readonly evidenceIds: readonly string[];
  readonly evidenceRoot: string;
  readonly dispatchReceiptIds: readonly string[];
  readonly governanceApprovalIds: readonly string[];
  readonly completionSummary: string;
  readonly unresolvedActions: readonly string[];
  readonly challengedReason?: string;
  readonly reviewedAt: string;
  readonly closureRoot: string;
  readonly closureHash: string;
  readonly safety: {
    readonly operationalOnly: true;
    readonly humanReviewRequired: true;
    readonly evidenceBound: true;
    readonly aiIsNeverFinalAuthority: true;
    readonly notEmergencyDeclaration: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRiskAfterActionReview = {
  readonly id: string;
  readonly closureId: string;
  readonly activationId: string;
  readonly alertId: string;
  readonly playbookId: string;
  readonly outcome: CanopyProofRiskAfterActionReviewOutcome;
  readonly reviewerId: string;
  readonly reviewerRole: CanopyProofRiskAfterActionReviewReviewerRole;
  readonly evidenceIds: readonly string[];
  readonly evidenceRoot: string;
  readonly closureRoot: string;
  readonly lessonsLearned: readonly string[];
  readonly correctiveActions: readonly string[];
  readonly policyRecommendationIds: readonly string[];
  readonly governanceApprovalIds: readonly string[];
  readonly followUpDueAt?: string;
  readonly reviewedAt: string;
  readonly reviewRoot: string;
  readonly reviewHash: string;
  readonly safety: {
    readonly postIncidentOnly: true;
    readonly humanReviewRequired: true;
    readonly evidenceBound: true;
    readonly aiIsNeverFinalAuthority: true;
    readonly notEmergencyDeclaration: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofRiskOverview = {
  readonly service: "canopyproof-early-warning";
  readonly activeAlertCount: number;
  readonly criticalAlertCount: number;
  readonly dispatchReceiptCount: number;
  readonly responsePlaybookCount: number;
  readonly responseActivationCount: number;
  readonly responseClosureCount: number;
  readonly afterActionReviewCount: number;
  readonly byRiskClass: Readonly<Record<CanopyProofRiskClass, number>>;
  readonly bySeverity: Readonly<Record<CanopyProofRiskLevel, number>>;
  readonly layers: readonly CanopyProofRiskLayer[];
  readonly lineage: {
    readonly signalRoot: string;
    readonly alertRoot: string;
    readonly responseRoot: string;
    readonly dispatchRoot: string;
    readonly playbookRoot: string;
    readonly activationRoot: string;
    readonly closureRoot: string;
    readonly afterActionReviewRoot: string;
    readonly auditRoot: string;
  };
  readonly publicClaimBoundary: {
    readonly noAutomatedEmergencyClaim: true;
    readonly humanReviewRequiredForPublicRelease: true;
    readonly disclosure: string;
  };
};

const riskSignalSchema = z
  .object({
    riskClass: z.enum(canopyProofRiskClasses),
    regionId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    sourceType: z.enum(["terra_scene", "field_evidence", "community_report", "open_climate"]),
    sourceId: z.string().min(1),
    observedAt: z.string().datetime().optional(),
    indicators: z.record(z.string(), z.number().min(0).max(100)).refine((value) => Object.keys(value).length > 0, {
      message: "Risk signal requires at least one bounded indicator.",
    }),
    confidenceScore: z.number().min(0).max(100),
    summary: z.string().min(3),
    recommendedAudience: z.array(z.enum(canopyProofAlertAudiences)).min(1).optional(),
  })
  .strict();

const acknowledgeSchema = z
  .object({
    audience: z.array(z.enum(canopyProofAlertAudiences)).min(1),
    note: z.string().min(1),
    acknowledgedAt: z.string().datetime().optional(),
  })
  .strict();

const escalateSchema = z
  .object({
    targetAudience: z.array(z.enum(canopyProofAlertAudiences)).min(1),
    rationale: z.string().min(1),
    publicMessage: z.string().min(1).optional(),
    governancePolicyId: z.string().min(1).optional(),
    reviewedBy: z.string().min(1).optional(),
    escalatedAt: z.string().datetime().optional(),
  })
  .strict();

const alertDispatchSchema = z
  .object({
    messageSummary: z.string().min(3),
    messageHash: z.string().min(16).optional(),
    policyId: z.string().min(1).optional(),
    dispatchedAt: z.string().datetime().optional(),
    recipients: z
      .array(
        z
          .object({
            audience: z.enum(canopyProofAlertAudiences),
            recipientId: z.string().min(1),
            organizationId: z.string().min(1).optional(),
            regionScope: z.string().min(1).optional(),
            channel: z.enum(canopyProofAlertDispatchChannels),
            deliveryStatus: z.enum(canopyProofAlertDispatchStatuses).optional(),
            deliveredAt: z.string().datetime().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

const responsePlaybookActivationSchema = z
  .object({
    playbookId: z.string().min(1),
    dispatchReceiptIds: z.array(z.string().min(1)).min(1).max(100),
    assignedAudience: z.array(z.enum(canopyProofAlertAudiences)).min(1),
    assignedOrganizationIds: z.array(z.string().min(1)).max(50).optional(),
    status: z.enum(canopyProofRiskResponseActivationStatuses).default("opened"),
    dueAt: z.string().datetime().optional(),
    evidenceIds: z.array(z.string().min(1)).max(100).optional(),
    note: z.string().min(8),
    activatedAt: z.string().datetime().optional(),
  })
  .strict();

const responseClosureSchema = z
  .object({
    decision: z.enum(canopyProofRiskResponseClosureDecisions),
    reviewerRole: z.enum(canopyProofRiskResponseClosureReviewerRoles),
    evidenceIds: z.array(z.string().min(1)).min(1).max(100),
    governanceApprovalIds: z.array(z.string().min(1)).max(20).optional(),
    completionSummary: z.string().min(12),
    unresolvedActions: z.array(z.string().min(1)).max(50).optional(),
    challengedReason: z.string().min(8).optional(),
    reviewedAt: z.string().datetime().optional(),
  })
  .strict();

const afterActionReviewSchema = z
  .object({
    outcome: z.enum(canopyProofRiskAfterActionReviewOutcomes),
    reviewerRole: z.enum(canopyProofRiskAfterActionReviewReviewerRoles),
    evidenceIds: z.array(z.string().min(1)).min(1).max(100),
    lessonsLearned: z.array(z.string().min(6)).min(1).max(50),
    correctiveActions: z.array(z.string().min(6)).max(50).optional(),
    policyRecommendationIds: z.array(z.string().min(1)).max(20).optional(),
    governanceApprovalIds: z.array(z.string().min(1)).max(20).optional(),
    followUpDueAt: z.string().datetime().optional(),
    reviewedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofEarlyWarningService {
  private readonly playbooksById = new Map<string, CanopyProofRiskResponsePlaybook>(
    buildDefaultRiskResponsePlaybooks().map((playbook) => [playbook.id, playbook]),
  );
  private readonly layersByRiskClass = new Map<CanopyProofRiskClass, CanopyProofRiskLayer>(
    buildRiskLayers().map((layer) => [layer.riskClass, layer]),
  );
  private readonly signalsById = new Map<string, CanopyProofRiskSignal>();
  private readonly alertsById = new Map<string, CanopyProofRiskAlert>();
  private readonly responsesById = new Map<string, CanopyProofRiskResponse>();
  private readonly dispatchReceiptsById = new Map<string, CanopyProofRiskAlertDispatchReceipt>();
  private readonly responseActivationsById = new Map<string, CanopyProofRiskResponseActivation>();
  private readonly responseClosuresById = new Map<string, CanopyProofRiskResponseClosure>();
  private readonly afterActionReviewsById = new Map<string, CanopyProofRiskAfterActionReview>();

  ingestSignal(input: unknown, actorId: string) {
    const parsed = riskSignalSchema.parse(input);
    const layer = this.getLayer(parsed.riskClass);
    assertSafeRiskText([parsed.regionId, parsed.projectId ?? "", parsed.sourceId, parsed.summary]);
    const observedAt = parsed.observedAt ?? new Date(0).toISOString();
    const severity = scoreRiskSeverity(parsed.indicators, parsed.confidenceScore, layer.thresholds);
    const recommendedAudience = parsed.recommendedAudience ?? defaultAudienceForSeverity(severity);
    const signalSeed = {
      riskClass: parsed.riskClass,
      regionId: parsed.regionId,
      projectId: parsed.projectId ?? null,
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      observedAt,
      indicators: normalizeIndicators(parsed.indicators),
      confidenceScore: parsed.confidenceScore,
      severity,
      summary: parsed.summary,
      recommendedAudience: [...new Set(recommendedAudience)].sort(),
    };
    const signalHash = hashJson({ kind: "canopyproof-risk-signal-v1", ...signalSeed });
    const signalId = `cp_risk_signal_${signalHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "risk_signal",
      entityId: signalId,
      payload: signalSeed,
      createdAt: observedAt,
      rationale: "Environmental early-warning signal ingested from bounded climate, satellite, or field evidence source.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof risk signal failed to append audit event.");
    }
    const signal: CanopyProofRiskSignal = {
      id: signalId,
      riskClass: parsed.riskClass,
      regionId: parsed.regionId,
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      observedAt,
      indicators: signalSeed.indicators,
      confidenceScore: parsed.confidenceScore,
      severity,
      summary: parsed.summary,
      recommendedAudience: signalSeed.recommendedAudience,
      signalHash,
      auditEvent,
    };
    this.signalsById.set(signal.id, signal);
    const alert = this.upsertAlertFromSignal(signal, actorId);
    return { signal, alert };
  }

  acknowledgeAlert(alertId: string, input: unknown, actorId: string) {
    const alert = this.getAlert(alertId);
    const parsed = acknowledgeSchema.parse(input);
    assertSafeRiskText([parsed.note]);
    const acknowledgedAt = parsed.acknowledgedAt ?? new Date(0).toISOString();
    const responseSeed = {
      alertId,
      responseType: "acknowledge" as const,
      audience: [...new Set(parsed.audience)].sort(),
      note: parsed.note,
      createdAt: acknowledgedAt,
    };
    const responseHash = hashJson({ kind: "canopyproof-risk-response-v1", ...responseSeed });
    const responseId = `cp_risk_response_${responseHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(alert.auditHistory, {
      action: "REASON",
      actor: actorId,
      entityType: "risk_response",
      entityId: responseId,
      payload: responseSeed,
      createdAt: acknowledgedAt,
      rationale: "Early-warning alert acknowledged by accountable actor and audience.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof risk acknowledgement failed to append audit event.");
    }
    const response: CanopyProofRiskResponse = {
      id: responseId,
      alertId,
      responseType: "acknowledge",
      actorId,
      audience: responseSeed.audience,
      note: parsed.note,
      createdAt: acknowledgedAt,
      auditEvent,
    };
    this.responsesById.set(response.id, response);
    this.alertsById.set(alert.id, {
      ...alert,
      status: alert.status === "escalated" ? "escalated" : "acknowledged",
      updatedAt: acknowledgedAt,
      auditHistory: [...alert.auditHistory, auditEvent],
    });
    return response;
  }

  escalateAlert(alertId: string, input: unknown, actorId: string) {
    const alert = this.getAlert(alertId);
    const parsed = escalateSchema.parse(input);
    assertSafeRiskText([parsed.rationale, parsed.publicMessage ?? "", parsed.governancePolicyId ?? "", parsed.reviewedBy ?? ""]);
    if (parsed.publicMessage && (!parsed.governancePolicyId || !parsed.reviewedBy)) {
      throw new Error("CanopyProof public risk release requires governancePolicyId and reviewedBy.");
    }
    const escalatedAt = parsed.escalatedAt ?? new Date(0).toISOString();
    const audience = [...new Set([...alert.audience, ...parsed.targetAudience])].sort();
    const responseSeed = {
      alertId,
      responseType: "escalate" as const,
      audience,
      note: parsed.rationale,
      publicMessage: parsed.publicMessage ?? null,
      governancePolicyId: parsed.governancePolicyId ?? null,
      reviewedBy: parsed.reviewedBy ?? null,
      createdAt: escalatedAt,
    };
    const responseHash = hashJson({ kind: "canopyproof-risk-response-v1", ...responseSeed });
    const responseId = `cp_risk_response_${responseHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(alert.auditHistory, {
      action: "DELEGATE",
      actor: actorId,
      entityType: "risk_response",
      entityId: responseId,
      payload: responseSeed,
      createdAt: escalatedAt,
      rationale: "Early-warning alert escalated to explicit audience with public-release guardrails.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof risk escalation failed to append audit event.");
    }
    const response: CanopyProofRiskResponse = {
      id: responseId,
      alertId,
      responseType: "escalate",
      actorId,
      audience,
      note: parsed.rationale,
      createdAt: escalatedAt,
      auditEvent,
    };
    this.responsesById.set(response.id, response);
    const updatedAlert: CanopyProofRiskAlert = {
      ...alert,
      status: "escalated",
      audience,
      ...(parsed.publicMessage ? { publicMessage: parsed.publicMessage } : {}),
      publicRelease: {
        allowed: Boolean(parsed.publicMessage && parsed.governancePolicyId && parsed.reviewedBy),
        ...(parsed.reviewedBy ? { reviewedBy: parsed.reviewedBy } : {}),
        reviewedAt: escalatedAt,
        ...(parsed.governancePolicyId ? { governancePolicyId: parsed.governancePolicyId } : {}),
        rationale: parsed.publicMessage
          ? "Public release reviewed under governance policy."
          : "Escalated internally without automated public emergency claim.",
      },
      updatedAt: escalatedAt,
      auditHistory: [...alert.auditHistory, auditEvent],
    };
    this.alertsById.set(updatedAlert.id, updatedAlert);
    return response;
  }

  dispatchAlert(alertId: string, input: unknown, actorId: string) {
    const alert = this.getAlert(alertId);
    const parsed = alertDispatchSchema.parse(input);
    assertSafeRiskText([parsed.messageSummary, parsed.policyId ?? ""]);
    assertNoRawContactText([
      parsed.messageSummary,
      parsed.messageHash ?? "",
      ...parsed.recipients.flatMap((recipient) => [
        recipient.recipientId,
        recipient.organizationId ?? "",
        recipient.regionScope ?? "",
      ]),
    ]);
    const dispatchedAt = parsed.dispatchedAt ?? new Date(0).toISOString();
    const messageHash =
      parsed.messageHash ??
      hashJson({
        kind: "canopyproof-risk-alert-message-v1",
        alertHash: alert.alertHash,
        messageSummary: parsed.messageSummary,
        policyId: parsed.policyId ?? null,
      });
    const sortedRecipients = [...parsed.recipients].sort(
      (left, right) =>
        left.audience.localeCompare(right.audience) ||
        left.recipientId.localeCompare(right.recipientId) ||
        left.channel.localeCompare(right.channel),
    );
    const receipts = sortedRecipients.map((recipient) => {
      if (!alert.audience.includes(recipient.audience)) {
        throw new Error(`CanopyProof risk dispatch audience is outside alert scope: ${recipient.audience}`);
      }
      const deliveryStatus = recipient.deliveryStatus ?? "queued";
      const deliveredAt = recipient.deliveredAt ?? (["delivered", "acknowledged"].includes(deliveryStatus) ? dispatchedAt : undefined);
      const receiptSeed = {
        alertId: alert.id,
        riskClass: alert.riskClass,
        regionId: alert.regionId,
        projectId: alert.projectId ?? null,
        recipientAudience: recipient.audience,
        recipientId: recipient.recipientId,
        organizationId: recipient.organizationId ?? null,
        regionScope: recipient.regionScope ?? null,
        channel: recipient.channel,
        deliveryStatus,
        messageHash,
        policyId: parsed.policyId ?? null,
        dispatchedBy: actorId,
        dispatchedAt,
        deliveredAt: deliveredAt ?? null,
      };
      const deliveryRoot = hashJson({
        kind: "canopyproof-risk-alert-delivery-root-v1",
        alertHash: alert.alertHash,
        receipt: receiptSeed,
      });
      const dispatchHash = hashJson({
        kind: "canopyproof-risk-alert-dispatch-v1",
        ...receiptSeed,
        deliveryRoot,
      });
      const receiptId = `cp_risk_dispatch_${dispatchHash.slice(0, 24)}`;
      const auditEvent = appendCanopyProofAuditEvent(alert.auditHistory, {
        action: deliveryStatus === "failed" ? "CHALLENGE" : "DELEGATE",
        actor: actorId,
        entityType: "risk_alert_dispatch",
        entityId: receiptId,
        payload: {
          ...receiptSeed,
          deliveryRoot,
          dispatchHash,
          safety: riskDispatchSafetyBoundary(),
        },
        createdAt: dispatchedAt,
        rationale: "Early-warning alert delivery receipt recorded for accountable community, NGO, government, or operational audience.",
      }).at(-1);
      if (!auditEvent) {
        throw new Error("CanopyProof risk alert dispatch failed to append audit event.");
      }
      const receipt: CanopyProofRiskAlertDispatchReceipt = {
        id: receiptId,
        alertId: alert.id,
        riskClass: alert.riskClass,
        regionId: alert.regionId,
        ...(alert.projectId ? { projectId: alert.projectId } : {}),
        recipientAudience: recipient.audience,
        recipientId: recipient.recipientId,
        ...(recipient.organizationId ? { organizationId: recipient.organizationId } : {}),
        ...(recipient.regionScope ? { regionScope: recipient.regionScope } : {}),
        channel: recipient.channel,
        deliveryStatus,
        messageHash,
        ...(parsed.policyId ? { policyId: parsed.policyId } : {}),
        deliveryRoot,
        dispatchHash,
        dispatchedBy: actorId,
        dispatchedAt,
        ...(deliveredAt ? { deliveredAt } : {}),
        safety: riskDispatchSafetyBoundary(),
        auditEvent,
      };
      this.dispatchReceiptsById.set(receipt.id, receipt);
      return receipt;
    });
    return {
      alert,
      dispatchRoot: hashRoot(receipts.map((receipt) => receipt.dispatchHash)),
      receipts,
    };
  }

  listResponsePlaybooks(filter: Readonly<{ riskClass?: string; audience?: string }> = {}) {
    const playbooks = [...this.playbooksById.values()];
    if (filter.riskClass && !canopyProofRiskClasses.includes(filter.riskClass as CanopyProofRiskClass)) {
      throw new Error(`CanopyProof risk response playbook risk class is invalid: ${filter.riskClass}`);
    }
    if (filter.audience && !canopyProofAlertAudiences.includes(filter.audience as CanopyProofAlertAudience)) {
      throw new Error(`CanopyProof risk response playbook audience is invalid: ${filter.audience}`);
    }
    return playbooks
      .filter((playbook) => !filter.riskClass || playbook.riskClass === filter.riskClass)
      .filter((playbook) => !filter.audience || playbook.audience.includes(filter.audience as CanopyProofAlertAudience))
      .sort((left, right) => left.riskClass.localeCompare(right.riskClass) || left.id.localeCompare(right.id));
  }

  getResponsePlaybook(playbookId: string) {
    const playbook = this.playbooksById.get(playbookId);
    if (!playbook) {
      throw new Error(`CanopyProof risk response playbook not found: ${playbookId}`);
    }
    return playbook;
  }

  activateResponsePlaybook(alertId: string, input: unknown, actorId: string) {
    const alert = this.getAlert(alertId);
    const parsed = responsePlaybookActivationSchema.parse(input);
    const playbook = this.getResponsePlaybook(parsed.playbookId);
    assertSafeRiskText([parsed.note, ...parsed.dispatchReceiptIds, ...(parsed.assignedOrganizationIds ?? []), ...(parsed.evidenceIds ?? [])]);
    assertNoRawContactText([parsed.note, ...parsed.dispatchReceiptIds, ...(parsed.assignedOrganizationIds ?? []), ...(parsed.evidenceIds ?? [])]);
    if (playbook.riskClass !== alert.riskClass) {
      throw new Error(`CanopyProof risk response playbook ${playbook.id} does not match alert risk class ${alert.riskClass}.`);
    }
    if (!isSeverityAtLeast(alert.severity, playbook.severityFloor)) {
      throw new Error(`CanopyProof risk response playbook ${playbook.id} requires severity ${playbook.severityFloor} or higher.`);
    }
    const assignedAudience = [...new Set(parsed.assignedAudience)].sort();
    assertAudienceSubset(assignedAudience, playbook.audience, "playbook");
    assertAudienceSubset(assignedAudience, alert.audience, "alert");
    assertRequiredAudiencePresent(playbook.requiredDispatchAudience, assignedAudience, playbook.id);

    const dispatchReceiptIds = [...new Set(parsed.dispatchReceiptIds)].sort();
    const receipts = dispatchReceiptIds.map((receiptId) => this.getDispatchReceipt(receiptId));
    for (const receipt of receipts) {
      if (receipt.alertId !== alert.id) {
        throw new Error(`CanopyProof risk response activation received dispatch receipt ${receipt.id} for a different alert.`);
      }
      if (!assignedAudience.includes(receipt.recipientAudience)) {
        throw new Error(`CanopyProof risk response activation receipt ${receipt.id} is outside assigned audience.`);
      }
    }
    for (const audience of assignedAudience) {
      const hasReceivedReceipt = receipts.some(
        (receipt) => receipt.recipientAudience === audience && ["delivered", "acknowledged"].includes(receipt.deliveryStatus),
      );
      if (!hasReceivedReceipt) {
        throw new Error(`CanopyProof risk response activation requires delivered or acknowledged dispatch receipt for ${audience}.`);
      }
    }

    const activatedAt = parsed.activatedAt ?? new Date(0).toISOString();
    const dueAt = parsed.dueAt ?? new Date(new Date(activatedAt).getTime() + playbook.responseWindowHours * 60 * 60 * 1000).toISOString();
    const evidenceIds = [...new Set(parsed.evidenceIds ?? [])].sort();
    const assignedOrganizationIds = [...new Set(parsed.assignedOrganizationIds ?? [])].sort();
    const activationSeed = {
      alertId: alert.id,
      playbookId: playbook.id,
      riskClass: alert.riskClass,
      severity: alert.severity,
      dispatchReceiptIds,
      assignedAudience,
      assignedOrganizationIds,
      status: parsed.status,
      dueAt,
      evidenceIds,
      note: parsed.note,
      activatedBy: actorId,
      activatedAt,
      playbookHash: playbook.playbookHash,
    };
    const activationRoot = hashJson({
      kind: "canopyproof-risk-response-activation-root-v1",
      activation: activationSeed,
      dispatchRoot: hashRoot(receipts.map((receipt) => receipt.dispatchHash)),
    });
    const activationHash = hashJson({
      kind: "canopyproof-risk-response-activation-v1",
      ...activationSeed,
      activationRoot,
    });
    const activationId = `cp_risk_activation_${activationHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(alert.auditHistory, {
      action: parsed.status === "challenged" ? "CHALLENGE" : "DELEGATE",
      actor: actorId,
      entityType: "risk_response_activation",
      entityId: activationId,
      payload: {
        ...activationSeed,
        activationRoot,
        activationHash,
        safety: riskPlaybookActivationSafetyBoundary(),
      },
      createdAt: activatedAt,
      rationale: "Early-warning response playbook activated after audience-scoped dispatch receipts were recorded.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof risk response playbook activation failed to append audit event.");
    }
    const activation: CanopyProofRiskResponseActivation = {
      id: activationId,
      alertId: alert.id,
      playbookId: playbook.id,
      riskClass: alert.riskClass,
      severity: alert.severity,
      dispatchReceiptIds,
      assignedAudience,
      assignedOrganizationIds,
      status: parsed.status,
      dueAt,
      evidenceIds,
      note: parsed.note,
      activatedBy: actorId,
      activatedAt,
      activationRoot,
      activationHash,
      safety: riskPlaybookActivationSafetyBoundary(),
      auditEvent,
    };
    this.responseActivationsById.set(activation.id, activation);
    return { playbook, activation };
  }

  closeResponseActivation(activationId: string, input: unknown, actorId: string, actorRole: CanopyProofRiskResponseClosureReviewerRole) {
    const activation = this.getResponseActivation(activationId);
    const alert = this.getAlert(activation.alertId);
    const playbook = this.getResponsePlaybook(activation.playbookId);
    const parsed = responseClosureSchema.parse(input);
    if (parsed.reviewerRole !== actorRole) {
      throw new Error("CANOPYPROOF_RBAC_DENIED: response closure reviewer role must match authenticated actor role.");
    }
    if (parsed.decision === "challenge" && !parsed.challengedReason) {
      throw new Error("CanopyProof risk response challenge requires challengedReason.");
    }
    if (parsed.decision === "complete" && (parsed.unresolvedActions?.length ?? 0) > 0) {
      throw new Error("CanopyProof risk response completion cannot contain unresolved actions.");
    }
    const valuesForSafety = [
      parsed.completionSummary,
      parsed.challengedReason ?? "",
      ...parsed.evidenceIds,
      ...(parsed.unresolvedActions ?? []),
      ...(parsed.governanceApprovalIds ?? []),
    ];
    assertSafeRiskText(valuesForSafety);
    assertNoRawContactText(valuesForSafety);
    const reviewedAt = parsed.reviewedAt ?? new Date(0).toISOString();
    const evidenceIds = [...new Set(parsed.evidenceIds)].sort();
    const governanceApprovalIds = [...new Set(parsed.governanceApprovalIds ?? [])].sort();
    const unresolvedActions = [...new Set(parsed.unresolvedActions ?? [])].sort();
    const closureSeed = {
      activationId: activation.id,
      alertId: alert.id,
      playbookId: playbook.id,
      decision: parsed.decision,
      reviewerId: actorId,
      reviewerRole: actorRole,
      evidenceIds,
      evidenceRoot: hashRoot(evidenceIds),
      dispatchReceiptIds: activation.dispatchReceiptIds,
      governanceApprovalIds,
      completionSummary: parsed.completionSummary,
      unresolvedActions,
      challengedReason: parsed.challengedReason ?? null,
      reviewedAt,
      activationHash: activation.activationHash,
      playbookHash: playbook.playbookHash,
    };
    const closureRoot = hashJson({
      kind: "canopyproof-risk-response-closure-root-v1",
      closure: closureSeed,
      safety: riskResponseClosureSafetyBoundary(),
    });
    const closureHash = hashJson({
      kind: "canopyproof-risk-response-closure-v1",
      ...closureSeed,
      closureRoot,
    });
    const closureId = `cp_risk_closure_${closureHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([activation.auditEvent], {
      action: parsed.decision === "complete" ? "FULFILL" : "CHALLENGE",
      actor: actorId,
      entityType: "risk_response_closure",
      entityId: closureId,
      payload: {
        ...closureSeed,
        closureRoot,
        closureHash,
        safety: riskResponseClosureSafetyBoundary(),
      },
      createdAt: reviewedAt,
      rationale:
        parsed.decision === "complete"
          ? "Early-warning response playbook closure recorded by human reviewer with evidence references."
          : "Early-warning response playbook challenge recorded by human reviewer with evidence references.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof risk response closure failed to append audit event.");
    }
    const closure: CanopyProofRiskResponseClosure = {
      id: closureId,
      activationId: activation.id,
      alertId: alert.id,
      playbookId: playbook.id,
      decision: parsed.decision,
      reviewerId: actorId,
      reviewerRole: actorRole,
      evidenceIds,
      evidenceRoot: closureSeed.evidenceRoot,
      dispatchReceiptIds: activation.dispatchReceiptIds,
      governanceApprovalIds,
      completionSummary: parsed.completionSummary,
      unresolvedActions,
      ...(parsed.challengedReason ? { challengedReason: parsed.challengedReason } : {}),
      reviewedAt,
      closureRoot,
      closureHash,
      safety: riskResponseClosureSafetyBoundary(),
      auditEvent,
    };
    this.responseClosuresById.set(closure.id, closure);
    return closure;
  }

  reviewClosedResponse(closureId: string, input: unknown, actorId: string, actorRole: CanopyProofRiskAfterActionReviewReviewerRole) {
    const closure = this.getResponseClosure(closureId);
    const activation = this.getResponseActivation(closure.activationId);
    const playbook = this.getResponsePlaybook(closure.playbookId);
    this.getAlert(closure.alertId);
    const parsed = afterActionReviewSchema.parse(input);
    if (parsed.reviewerRole !== actorRole) {
      throw new Error("CANOPYPROOF_RBAC_DENIED: after-action reviewer role must match authenticated actor role.");
    }
    if (closure.decision === "challenge" && parsed.outcome === "accepted") {
      throw new Error("CanopyProof challenged response closures require follow-up or governance escalation.");
    }
    const correctiveActions = [...new Set(parsed.correctiveActions ?? [])].sort();
    if (parsed.outcome !== "accepted" && correctiveActions.length === 0) {
      throw new Error("CanopyProof after-action review requires correctiveActions unless the closure is accepted.");
    }
    const policyRecommendationIds = [...new Set(parsed.policyRecommendationIds ?? [])].sort();
    if (parsed.outcome === "escalated_to_governance" && policyRecommendationIds.length === 0) {
      throw new Error("CanopyProof after-action governance escalation requires at least one policyRecommendationId.");
    }

    const evidenceIds = [...new Set(parsed.evidenceIds)].sort();
    for (const evidenceId of closure.evidenceIds) {
      if (!evidenceIds.includes(evidenceId)) {
        throw new Error(`CanopyProof after-action review must preserve closure evidence reference: ${evidenceId}.`);
      }
    }
    const lessonsLearned = [...new Set(parsed.lessonsLearned)].sort();
    const governanceApprovalIds = [...new Set(parsed.governanceApprovalIds ?? [])].sort();
    const valuesForSafety = [
      ...evidenceIds,
      ...lessonsLearned,
      ...correctiveActions,
      ...policyRecommendationIds,
      ...governanceApprovalIds,
    ];
    assertSafeRiskText(valuesForSafety);
    assertNoRawContactText(valuesForSafety);

    const reviewedAt = parsed.reviewedAt ?? new Date(0).toISOString();
    const reviewSeed = {
      closureId: closure.id,
      activationId: activation.id,
      alertId: closure.alertId,
      playbookId: playbook.id,
      outcome: parsed.outcome,
      reviewerId: actorId,
      reviewerRole: actorRole,
      evidenceIds,
      evidenceRoot: hashRoot(evidenceIds),
      closureRoot: closure.closureRoot,
      lessonsLearned,
      correctiveActions,
      policyRecommendationIds,
      governanceApprovalIds,
      followUpDueAt: parsed.followUpDueAt ?? null,
      reviewedAt,
      closureHash: closure.closureHash,
      activationHash: activation.activationHash,
      playbookHash: playbook.playbookHash,
    };
    const reviewRoot = hashJson({
      kind: "canopyproof-risk-after-action-review-root-v1",
      review: reviewSeed,
      safety: riskAfterActionReviewSafetyBoundary(),
    });
    const reviewHash = hashJson({
      kind: "canopyproof-risk-after-action-review-v1",
      ...reviewSeed,
      reviewRoot,
    });
    const reviewId = `cp_risk_after_action_${reviewHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([closure.auditEvent], {
      action: parsed.outcome === "escalated_to_governance" ? "DELEGATE" : parsed.outcome === "accepted" ? "FULFILL" : "REASON",
      actor: actorId,
      entityType: "risk_after_action_review",
      entityId: reviewId,
      payload: {
        ...reviewSeed,
        reviewRoot,
        reviewHash,
        safety: riskAfterActionReviewSafetyBoundary(),
      },
      createdAt: reviewedAt,
      rationale: "Early-warning response after-action review recorded by institutional human reviewer with evidence-bound lessons and corrective actions.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof risk after-action review failed to append audit event.");
    }

    const review: CanopyProofRiskAfterActionReview = {
      id: reviewId,
      closureId: closure.id,
      activationId: activation.id,
      alertId: closure.alertId,
      playbookId: playbook.id,
      outcome: parsed.outcome,
      reviewerId: actorId,
      reviewerRole: actorRole,
      evidenceIds,
      evidenceRoot: reviewSeed.evidenceRoot,
      closureRoot: closure.closureRoot,
      lessonsLearned,
      correctiveActions,
      policyRecommendationIds,
      governanceApprovalIds,
      ...(parsed.followUpDueAt ? { followUpDueAt: parsed.followUpDueAt } : {}),
      reviewedAt,
      reviewRoot,
      reviewHash,
      safety: riskAfterActionReviewSafetyBoundary(),
      auditEvent,
    };
    this.afterActionReviewsById.set(review.id, review);
    return review;
  }

  listLayers() {
    return [...this.layersByRiskClass.values()].sort((left, right) => left.riskClass.localeCompare(right.riskClass));
  }

  getLayer(riskClass: string) {
    if (!canopyProofRiskClasses.includes(riskClass as CanopyProofRiskClass)) {
      throw new Error(`CanopyProof risk layer not found: ${riskClass}`);
    }
    const layer = this.layersByRiskClass.get(riskClass as CanopyProofRiskClass);
    if (!layer) {
      throw new Error(`CanopyProof risk layer not found: ${riskClass}`);
    }
    return layer;
  }

  listSignals(riskClass?: string) {
    const signals = [...this.signalsById.values()];
    return (riskClass ? signals.filter((signal) => signal.riskClass === riskClass) : signals).sort((left, right) =>
      right.observedAt.localeCompare(left.observedAt),
    );
  }

  listAlerts(riskClass?: string) {
    const alerts = [...this.alertsById.values()];
    return (riskClass ? alerts.filter((alert) => alert.riskClass === riskClass) : alerts).sort((left, right) =>
      severityWeight(right.severity) - severityWeight(left.severity) || right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  getAlert(alertId: string) {
    const alert = this.alertsById.get(alertId);
    if (!alert) {
      throw new Error(`CanopyProof risk alert not found: ${alertId}`);
    }
    return alert;
  }

  listResponses(alertId?: string) {
    const responses = [...this.responsesById.values()];
    return (alertId ? responses.filter((response) => response.alertId === alertId) : responses).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  listDispatchReceipts(alertId?: string) {
    const receipts = [...this.dispatchReceiptsById.values()];
    return (alertId ? receipts.filter((receipt) => receipt.alertId === alertId) : receipts).sort((left, right) =>
      right.dispatchedAt.localeCompare(left.dispatchedAt) || left.id.localeCompare(right.id),
    );
  }

  getDispatchReceipt(receiptId: string) {
    const receipt = this.dispatchReceiptsById.get(receiptId);
    if (!receipt) {
      throw new Error(`CanopyProof risk alert dispatch receipt not found: ${receiptId}`);
    }
    return receipt;
  }

  listResponseActivations(alertId?: string) {
    const activations = [...this.responseActivationsById.values()];
    return (alertId ? activations.filter((activation) => activation.alertId === alertId) : activations).sort((left, right) =>
      right.activatedAt.localeCompare(left.activatedAt) || left.id.localeCompare(right.id),
    );
  }

  getResponseActivation(activationId: string) {
    const activation = this.responseActivationsById.get(activationId);
    if (!activation) {
      throw new Error(`CanopyProof risk response playbook activation not found: ${activationId}`);
    }
    return activation;
  }

  listResponseClosures(activationId?: string) {
    const closures = [...this.responseClosuresById.values()];
    return (activationId ? closures.filter((closure) => closure.activationId === activationId) : closures).sort((left, right) =>
      right.reviewedAt.localeCompare(left.reviewedAt) || left.id.localeCompare(right.id),
    );
  }

  getResponseClosure(closureId: string) {
    const closure = this.responseClosuresById.get(closureId);
    if (!closure) {
      throw new Error(`CanopyProof risk response closure not found: ${closureId}`);
    }
    return closure;
  }

  listAfterActionReviews(closureId?: string) {
    const reviews = [...this.afterActionReviewsById.values()];
    return (closureId ? reviews.filter((review) => review.closureId === closureId) : reviews).sort((left, right) =>
      right.reviewedAt.localeCompare(left.reviewedAt) || left.id.localeCompare(right.id),
    );
  }

  getAfterActionReview(reviewId: string) {
    const review = this.afterActionReviewsById.get(reviewId);
    if (!review) {
      throw new Error(`CanopyProof risk after-action review not found: ${reviewId}`);
    }
    return review;
  }

  getOverview(): CanopyProofRiskOverview {
    const alerts = this.listAlerts();
    const activeAlerts = alerts.filter((alert) => !["resolved", "challenged"].includes(alert.status));
    const signals = this.listSignals();
    const responses = this.listResponses();
    const dispatchReceipts = this.listDispatchReceipts();
    const playbooks = this.listResponsePlaybooks();
    const activations = this.listResponseActivations();
    const closures = this.listResponseClosures();
    const afterActionReviews = this.listAfterActionReviews();
    const auditRoots = [
      ...signals.map((signal) => signal.auditEvent.eventRoot),
      ...alerts.flatMap((alert) => alert.auditHistory.map((event) => event.eventRoot)),
      ...responses.map((response) => response.auditEvent.eventRoot),
      ...dispatchReceipts.map((receipt) => receipt.auditEvent.eventRoot),
      ...activations.map((activation) => activation.auditEvent.eventRoot),
      ...closures.map((closure) => closure.auditEvent.eventRoot),
      ...afterActionReviews.map((review) => review.auditEvent.eventRoot),
    ];
    return {
      service: "canopyproof-early-warning",
      activeAlertCount: activeAlerts.length,
      criticalAlertCount: activeAlerts.filter((alert) => alert.severity === "critical").length,
      dispatchReceiptCount: dispatchReceipts.length,
      responsePlaybookCount: playbooks.length,
      responseActivationCount: activations.length,
      responseClosureCount: closures.length,
      afterActionReviewCount: afterActionReviews.length,
      byRiskClass: countByRiskClass(activeAlerts),
      bySeverity: countBySeverity(activeAlerts),
      layers: this.listLayers(),
      lineage: {
        signalRoot: hashRoot(signals.map((signal) => signal.signalHash)),
        alertRoot: hashRoot(alerts.map((alert) => alert.alertHash)),
        responseRoot: hashRoot(responses.map((response) => response.auditEvent.eventRoot)),
        dispatchRoot: hashRoot(dispatchReceipts.map((receipt) => receipt.dispatchHash)),
        playbookRoot: hashRoot(playbooks.map((playbook) => playbook.playbookHash)),
        activationRoot: hashRoot(activations.map((activation) => activation.activationHash)),
        closureRoot: hashRoot(closures.map((closure) => closure.closureHash)),
        afterActionReviewRoot: hashRoot(afterActionReviews.map((review) => review.reviewHash)),
        auditRoot: hashRoot(auditRoots),
      },
      publicClaimBoundary: {
        noAutomatedEmergencyClaim: true,
        humanReviewRequiredForPublicRelease: true,
        disclosure:
          "CanopyProof early warnings are operational alerts. Public emergency statements require human review and governance policy approval.",
      },
    };
  }

  getStatus() {
    const overview = this.getOverview();
    return {
      service: overview.service,
      activeAlertCount: overview.activeAlertCount,
      criticalAlertCount: overview.criticalAlertCount,
      signalCount: this.signalsById.size,
      responseCount: this.responsesById.size,
      dispatchReceiptCount: this.dispatchReceiptsById.size,
      responsePlaybookCount: this.playbooksById.size,
      responseActivationCount: this.responseActivationsById.size,
      responseClosureCount: this.responseClosuresById.size,
      afterActionReviewCount: this.afterActionReviewsById.size,
      riskClasses: canopyProofRiskClasses,
      audiences: canopyProofAlertAudiences,
      statuses: canopyProofAlertStatuses,
      dispatchChannels: canopyProofAlertDispatchChannels,
      dispatchStatuses: canopyProofAlertDispatchStatuses,
      responsePlaybookActionTypes: canopyProofRiskResponsePlaybookActionTypes,
      responseActivationStatuses: canopyProofRiskResponseActivationStatuses,
      responseClosureDecisions: canopyProofRiskResponseClosureDecisions,
      responseClosureReviewerRoles: canopyProofRiskResponseClosureReviewerRoles,
      afterActionReviewOutcomes: canopyProofRiskAfterActionReviewOutcomes,
      afterActionReviewReviewerRoles: canopyProofRiskAfterActionReviewReviewerRoles,
      publicClaimBoundary: overview.publicClaimBoundary,
    };
  }

  private upsertAlertFromSignal(signal: CanopyProofRiskSignal, actorId: string) {
    const existing = this
      .listAlerts(signal.riskClass)
      .find((alert) => alert.regionId === signal.regionId && alert.projectId === signal.projectId && !["resolved", "challenged"].includes(alert.status));
    const createdAt = signal.observedAt;
    const alertSeed = {
      riskClass: signal.riskClass,
      regionId: signal.regionId,
      projectId: signal.projectId ?? null,
      severity: signal.severity,
      status: ["high", "critical"].includes(signal.severity) ? "review_required" : "watch",
      audience: signal.recommendedAudience,
      signalIds: existing ? [...existing.signalIds, signal.id].sort() : [signal.id],
      summary: signal.summary,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: createdAt,
      publicRelease: {
        allowed: false,
        rationale: "Automated signal created an operational alert only; public emergency release requires human review.",
      },
    };
    const alertHash = hashJson({ kind: "canopyproof-risk-alert-v1", ...alertSeed });
    const alertId = existing?.id ?? `cp_risk_alert_${alertHash.slice(0, 24)}`;
    const auditHistory = appendCanopyProofAuditEvent(existing?.auditHistory ?? [], {
      action: existing ? "REASON" : "ASSERT",
      actor: actorId,
      entityType: "risk_alert",
      entityId: alertId,
      payload: alertSeed,
      createdAt,
      rationale: existing
        ? "Environmental early-warning alert updated with additional signal."
        : "Environmental early-warning alert opened from climate and field signal.",
    });
    const alert: CanopyProofRiskAlert = {
      id: alertId,
      riskClass: signal.riskClass,
      regionId: signal.regionId,
      ...(signal.projectId ? { projectId: signal.projectId } : {}),
      severity: maxSeverity(existing?.severity, signal.severity),
      status: existing?.status === "escalated" ? "escalated" : (alertSeed.status as CanopyProofAlertStatus),
      audience: [...new Set(alertSeed.audience)].sort(),
      signalIds: alertSeed.signalIds,
      summary: signal.summary,
      publicRelease: alertSeed.publicRelease,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: createdAt,
      alertHash,
      auditHistory,
    };
    this.alertsById.set(alert.id, alert);
    return alert;
  }
}

function buildRiskLayers(): readonly CanopyProofRiskLayer[] {
  const layers: Array<Omit<CanopyProofRiskLayer, "layerHash">> = [
    {
      id: "cp_risk_layer_drought",
      riskClass: "drought",
      title: "Drought Stress",
      description: "Soil-moisture, rainfall deficit, vegetation stress, and field water evidence warning layer.",
      sourceFamilies: ["terra", "field_evidence", "open_climate"],
      indicatorKeys: ["soilMoistureDeficit", "rainfallDeficit", "vegetationStress"],
      updateCadence: "daily",
      thresholds: { watch: 35, high: 65, critical: 85 },
    },
    {
      id: "cp_risk_layer_wildfire",
      riskClass: "wildfire",
      title: "Wildfire Exposure",
      description: "Thermal anomaly, burn risk, dryness, and community fire-observation warning layer.",
      sourceFamilies: ["terra", "community", "open_climate"],
      indicatorKeys: ["thermalAnomaly", "fuelDryness", "windExposure"],
      updateCadence: "hourly",
      thresholds: { watch: 30, high: 60, critical: 80 },
    },
    {
      id: "cp_risk_layer_flooding",
      riskClass: "flooding",
      title: "Flooding Exposure",
      description: "Rainfall intensity, river-level anomaly, surface water expansion, and local field warning layer.",
      sourceFamilies: ["terra", "field_evidence", "community", "open_climate"],
      indicatorKeys: ["rainfallIntensity", "riverAnomaly", "surfaceWaterExpansion"],
      updateCadence: "hourly",
      thresholds: { watch: 35, high: 65, critical: 85 },
    },
    {
      id: "cp_risk_layer_ecosystem_degradation",
      riskClass: "ecosystem_degradation",
      title: "Ecosystem Degradation",
      description: "Land-change, NDVI decline, biodiversity signal loss, and restoration failure warning layer.",
      sourceFamilies: ["terra", "field_evidence", "community"],
      indicatorKeys: ["ndviDecline", "landChange", "biodiversityLoss"],
      updateCadence: "weekly",
      thresholds: { watch: 30, high: 55, critical: 75 },
    },
  ];
  return layers.map((layer) => ({
    ...layer,
    layerHash: hashJson({ kind: "canopyproof-risk-layer-v1", ...layer }),
  }));
}

function buildDefaultRiskResponsePlaybooks(): readonly CanopyProofRiskResponsePlaybook[] {
  const playbooks: Array<Omit<CanopyProofRiskResponsePlaybook, "createdAt" | "playbookHash" | "safety">> = [
    {
      id: "cp_risk_playbook_drought_field_response_v1",
      riskClass: "drought",
      severityFloor: "high",
      audience: ["community", "ngo", "government", "operator", "verifier"],
      requiredDispatchAudience: ["community", "ngo", "government"],
      title: "Drought Field Response Coordination",
      objective: "Coordinate field water-stress checks, community briefings, and government/NGO operational review without issuing public emergency claims.",
      responseWindowHours: 24,
      governancePolicyId: "canopyproof_policy_public_risk_release_v1",
      steps: [
        {
          id: "drought_field_assessment",
          actionType: "field_assessment",
          title: "Ground-truth water stress",
          accountableAudience: ["community", "ngo"],
          requiredEvidenceTypes: ["field_photo", "gps_observation", "soil_moisture_note"],
          completionCriteria: ["At least one community field observation is linked.", "NGO verifier records bounded field assessment notes."],
        },
        {
          id: "drought_government_coordination",
          actionType: "government_coordination",
          title: "Coordinate public-sector operational review",
          accountableAudience: ["government", "operator"],
          requiredEvidenceTypes: ["dispatch_receipt", "operational_note"],
          completionCriteria: ["Government audience has received the alert.", "No public emergency statement is issued without governance approval."],
        },
      ],
    },
    {
      id: "cp_risk_playbook_wildfire_watch_v1",
      riskClass: "wildfire",
      severityFloor: "high",
      audience: ["community", "ngo", "government", "operator", "verifier"],
      requiredDispatchAudience: ["community", "government"],
      title: "Wildfire Watch Coordination",
      objective: "Coordinate community observation, satellite review, and government operational awareness for wildfire exposure.",
      responseWindowHours: 6,
      governancePolicyId: "canopyproof_policy_public_risk_release_v1",
      steps: [
        {
          id: "wildfire_fire_watch",
          actionType: "fire_watch",
          title: "Open bounded fire-watch review",
          accountableAudience: ["community", "government"],
          requiredEvidenceTypes: ["community_observation", "thermal_anomaly_reference"],
          completionCriteria: ["Community observation window opened.", "Government coordination receipt is present."],
        },
        {
          id: "wildfire_satellite_review",
          actionType: "satellite_review",
          title: "Cross-check TerraProof scene",
          accountableAudience: ["verifier", "operator"],
          requiredEvidenceTypes: ["terra_scene", "open_climate_reference"],
          completionCriteria: ["Satellite scene is linked.", "Verifier records bounded interpretation."],
        },
      ],
    },
    {
      id: "cp_risk_playbook_flood_watch_v1",
      riskClass: "flooding",
      severityFloor: "high",
      audience: ["community", "ngo", "government", "operator", "verifier"],
      requiredDispatchAudience: ["community", "ngo", "government"],
      title: "Flood Watch Coordination",
      objective: "Coordinate surface-water field reports and public-sector operational awareness for flooding exposure.",
      responseWindowHours: 8,
      governancePolicyId: "canopyproof_policy_public_risk_release_v1",
      steps: [
        {
          id: "flood_field_watch",
          actionType: "flood_watch",
          title: "Collect bounded water-level observations",
          accountableAudience: ["community", "ngo"],
          requiredEvidenceTypes: ["field_photo", "gps_observation", "water_level_note"],
          completionCriteria: ["Field observers submit bounded local reports.", "NGO reviewer checks source completeness."],
        },
        {
          id: "flood_government_coordination",
          actionType: "government_coordination",
          title: "Notify government operational audience",
          accountableAudience: ["government", "operator"],
          requiredEvidenceTypes: ["dispatch_receipt", "operational_note"],
          completionCriteria: ["Government audience receipt is delivered or acknowledged.", "No emergency declaration is made by CanopyProof."],
        },
      ],
    },
    {
      id: "cp_risk_playbook_ecosystem_degradation_review_v1",
      riskClass: "ecosystem_degradation",
      severityFloor: "medium",
      audience: ["community", "ngo", "operator", "verifier"],
      requiredDispatchAudience: ["community", "ngo"],
      title: "Ecosystem Degradation Review",
      objective: "Coordinate community biodiversity observations, NGO field review, and TerraProof cross-checking for degradation signals.",
      responseWindowHours: 72,
      governancePolicyId: "canopyproof_policy_public_risk_release_v1",
      steps: [
        {
          id: "ecosystem_survey",
          actionType: "ecosystem_survey",
          title: "Collect biodiversity and restoration-health evidence",
          accountableAudience: ["community", "ngo"],
          requiredEvidenceTypes: ["biodiversity_observation", "restoration_photo", "field_note"],
          completionCriteria: ["Community observation is linked.", "NGO review note is recorded."],
        },
        {
          id: "ecosystem_satellite_review",
          actionType: "satellite_review",
          title: "Cross-check NDVI and land-change layers",
          accountableAudience: ["verifier", "operator"],
          requiredEvidenceTypes: ["terra_scene", "ndvi_reference"],
          completionCriteria: ["TerraProof scene root is referenced.", "Verifier records non-final interpretation."],
        },
      ],
    },
  ];
  const createdAt = new Date(0).toISOString();
  return playbooks.map((playbook) => {
    const safety = riskPlaybookSafetyBoundary();
    const seed = { ...playbook, safety, createdAt };
    return {
      ...seed,
      playbookHash: hashJson({ kind: "canopyproof-risk-response-playbook-v1", ...seed }),
    };
  });
}

function normalizeIndicators(indicators: Readonly<Record<string, number>>) {
  return Object.fromEntries(Object.entries(indicators).sort(([left], [right]) => left.localeCompare(right)));
}

function scoreRiskSeverity(
  indicators: Readonly<Record<string, number>>,
  confidenceScore: number,
  thresholds: CanopyProofRiskLayer["thresholds"],
): CanopyProofRiskLevel {
  const maxIndicator = Math.max(...Object.values(indicators));
  const score = maxIndicator * (confidenceScore / 100);
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.watch) return "medium";
  return "low";
}

function defaultAudienceForSeverity(severity: CanopyProofRiskLevel): readonly CanopyProofAlertAudience[] {
  if (severity === "critical") return ["community", "ngo", "government", "operator", "verifier"];
  if (severity === "high") return ["community", "ngo", "operator", "verifier"];
  return ["operator", "verifier"];
}

function maxSeverity(current: CanopyProofRiskLevel | undefined, next: CanopyProofRiskLevel): CanopyProofRiskLevel {
  if (!current) return next;
  return severityWeight(next) > severityWeight(current) ? next : current;
}

function severityWeight(severity: CanopyProofRiskLevel) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function countByRiskClass(alerts: readonly CanopyProofRiskAlert[]) {
  return Object.fromEntries(canopyProofRiskClasses.map((riskClass) => [riskClass, alerts.filter((alert) => alert.riskClass === riskClass).length])) as Record<
    CanopyProofRiskClass,
    number
  >;
}

function countBySeverity(alerts: readonly CanopyProofRiskAlert[]) {
  const severities: readonly CanopyProofRiskLevel[] = ["low", "medium", "high", "critical"];
  return Object.fromEntries(severities.map((severity) => [severity, alerts.filter((alert) => alert.severity === severity).length])) as Record<
    CanopyProofRiskLevel,
    number
  >;
}

function hashRoot(values: readonly string[]) {
  return values.length > 0 ? merkleRoot([...values].sort()) : hashJson({ kind: "canopyproof-empty-root-v1" });
}

function riskDispatchSafetyBoundary(): CanopyProofRiskAlertDispatchReceipt["safety"] {
  return {
    noPrivateContactData: true,
    audienceScoped: true,
    noAutomatedEmergencyClaim: true,
    humanReviewRequiredForPublicRelease: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
  };
}

function riskPlaybookSafetyBoundary(): CanopyProofRiskResponsePlaybook["safety"] {
  return {
    operationalOnly: true,
    notEmergencyDeclaration: true,
    humanAuthorityRequired: true,
    evidenceRequiredForClosure: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
  };
}

function riskPlaybookActivationSafetyBoundary(): CanopyProofRiskResponseActivation["safety"] {
  return {
    ...riskPlaybookSafetyBoundary(),
    aiCannotClosePlaybook: true,
  };
}

function riskResponseClosureSafetyBoundary(): CanopyProofRiskResponseClosure["safety"] {
  return {
    operationalOnly: true,
    humanReviewRequired: true,
    evidenceBound: true,
    aiIsNeverFinalAuthority: true,
    notEmergencyDeclaration: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  };
}

function riskAfterActionReviewSafetyBoundary(): CanopyProofRiskAfterActionReview["safety"] {
  return {
    postIncidentOnly: true,
    humanReviewRequired: true,
    evidenceBound: true,
    aiIsNeverFinalAuthority: true,
    notEmergencyDeclaration: true,
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
  };
}

function isSeverityAtLeast(actual: CanopyProofRiskLevel, floor: CanopyProofRiskLevel) {
  return severityWeight(actual) >= severityWeight(floor);
}

function assertAudienceSubset(
  requestedAudience: readonly CanopyProofAlertAudience[],
  allowedAudience: readonly CanopyProofAlertAudience[],
  scope: "alert" | "playbook",
) {
  for (const audience of requestedAudience) {
    if (!allowedAudience.includes(audience)) {
      throw new Error(`CanopyProof risk response activation audience ${audience} is outside ${scope} scope.`);
    }
  }
}

function assertRequiredAudiencePresent(
  requiredAudience: readonly CanopyProofAlertAudience[],
  assignedAudience: readonly CanopyProofAlertAudience[],
  playbookId: string,
) {
  const missingAudience = requiredAudience.filter((audience) => !assignedAudience.includes(audience));
  if (missingAudience.length > 0) {
    throw new Error(`CanopyProof risk response playbook ${playbookId} requires assigned audience: ${missingAudience.join(",")}.`);
  }
}

function assertSafeRiskText(values: readonly string[]) {
  const unsafePatterns = [
    /\bguaranteed\s+safety\b/i,
    /\bofficial\s+emergency\s+declaration\b/i,
    /\bcertified\s+disaster\s+claim\b/i,
    /\bcertified\s+carbon\s+credit\b/i,
    /\bcarbon[-\s]?tax\s+offset\b/i,
    /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
  ];
  for (const value of values) {
    if (!value) continue;
    for (const pattern of unsafePatterns) {
      if (pattern.test(value) && !/\b(no|not|never|without)\b/i.test(value)) {
        throw new Error(`CanopyProof risk input contains unsupported public claim: ${value}`);
      }
    }
  }
}

function assertNoRawContactText(values: readonly string[]) {
  const rawContactPatterns = [/@/, /\bmailto:/i, /\btel:/i, /\+\d[\d\s().-]{6,}\d/];
  for (const value of values) {
    if (!value) continue;
    for (const pattern of rawContactPatterns) {
      if (pattern.test(value)) {
        throw new Error("CanopyProof risk dispatch receipts must not contain raw private contact data.");
      }
    }
  }
}
