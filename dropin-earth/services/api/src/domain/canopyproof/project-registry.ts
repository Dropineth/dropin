import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofProjectTypes = [
  "reforestation",
  "ecosystem_restoration",
  "biodiversity",
  "water",
  "soil_regeneration",
  "climate_observation",
] as const;

export const canopyProofProjectStatuses = ["submitted", "under_review", "active", "monitored", "challenged", "suspended", "archived"] as const;
export const canopyProofProjectMonitoringEventTypes = [
  "field_observation",
  "terra_scene_review",
  "biodiversity_survey",
  "water_measurement",
  "survival_check",
  "risk_signal",
] as const;
export const canopyProofProjectMonitoringStates = ["submitted", "accepted", "needs_review", "challenged"] as const;

export type CanopyProofProjectType = (typeof canopyProofProjectTypes)[number];
export type CanopyProofProjectStatus = (typeof canopyProofProjectStatuses)[number];
export type CanopyProofProjectMonitoringEventType = (typeof canopyProofProjectMonitoringEventTypes)[number];
export type CanopyProofProjectMonitoringState = (typeof canopyProofProjectMonitoringStates)[number];

export type CanopyProofProjectLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly areaHectares: number;
  readonly boundaryHash?: string;
};

export type CanopyProofProjectClaimBoundary = {
  readonly restorationProjectRegistryOnly: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
  readonly disclosure: string;
};

export type CanopyProofProjectProfile = {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly projectType: CanopyProofProjectType;
  readonly regionId: string;
  readonly location: CanopyProofProjectLocation;
  readonly targetTreeCount: number;
  readonly biodiversityIndicators: readonly string[];
  readonly waterIndicators: readonly string[];
  readonly climateRiskIndicators: readonly string[];
  readonly monitoringCadenceDays: number;
  readonly governancePolicyId?: string;
  readonly governanceApprovalId?: string;
  readonly status: CanopyProofProjectStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly createdByRole: "owner" | "admin" | "verifier";
  readonly projectHash: string;
  readonly projectRoot: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
  readonly claimBoundary: CanopyProofProjectClaimBoundary;
};

export type CanopyProofProjectStatusTransition = {
  readonly id: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly previousStatus: CanopyProofProjectStatus;
  readonly status: CanopyProofProjectStatus;
  readonly previousProjectRoot: string;
  readonly governanceApprovalId?: string;
  readonly rationale: string;
  readonly updatedBy: string;
  readonly updaterRole: "owner" | "admin" | "verifier";
  readonly updatedAt: string;
  readonly transitionHash: string;
  readonly transitionRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofProjectMonitoringEvent = {
  readonly id: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly eventType: CanopyProofProjectMonitoringEventType;
  readonly observedAt: string;
  readonly observedBy: string;
  readonly observerRole: "owner" | "admin" | "verifier" | "researcher";
  readonly previousStatus: CanopyProofProjectStatus;
  readonly projectStatus: CanopyProofProjectStatus;
  readonly previousProjectRoot: string;
  readonly evidenceIds: readonly string[];
  readonly terraSceneIds: readonly string[];
  readonly biodiversityIndicators: readonly string[];
  readonly waterIndicators: readonly string[];
  readonly climateRiskIndicators: readonly string[];
  readonly metrics: Readonly<Record<string, number>>;
  readonly state: CanopyProofProjectMonitoringState;
  readonly rationale: string;
  readonly eventHash: string;
  readonly monitoringRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofProjectAuthoritySnapshot = {
  readonly projects: readonly CanopyProofProjectProfile[];
  readonly statusTransitions?: readonly CanopyProofProjectStatusTransition[];
  readonly monitoringEvents?: readonly CanopyProofProjectMonitoringEvent[];
};

export type CanopyProofProjectRegistryStatus = {
  readonly service: "canopyproof-project-registry";
  readonly projectCount: number;
  readonly activeProjectCount: number;
  readonly challengedProjectCount: number;
  readonly statusTransitionCount: number;
  readonly monitoringEventCount: number;
  readonly challengedMonitoringEventCount: number;
  readonly projectRoot: string;
  readonly monitoringRoot: string;
  readonly supportedProjectTypes: readonly CanopyProofProjectType[];
  readonly supportedStatuses: readonly CanopyProofProjectStatus[];
  readonly supportedMonitoringEventTypes: readonly CanopyProofProjectMonitoringEventType[];
  readonly supportedMonitoringStates: readonly CanopyProofProjectMonitoringState[];
  readonly safety: {
    readonly projectsAreAudited: true;
    readonly monitoringEventsAreAudited: true;
    readonly publicClaimsBounded: true;
    readonly activeStatusRequiresGovernanceApproval: true;
    readonly noFinancialOrCarbonCreditClaims: true;
  };
};

const projectLocationSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    areaHectares: z.number().finite().nonnegative(),
    boundaryHash: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i).optional(),
  })
  .strict();

const projectRegistrationSchema = z
  .object({
    id: z.string().min(1).optional(),
    organizationId: z.string().min(1),
    title: z.string().trim().min(3).max(240),
    projectType: z.enum(canopyProofProjectTypes),
    regionId: z.string().trim().min(1).max(160),
    location: projectLocationSchema,
    targetTreeCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
    biodiversityIndicators: z.array(z.string().trim().min(1).max(240)).max(128).default([]),
    waterIndicators: z.array(z.string().trim().min(1).max(240)).max(128).default([]),
    climateRiskIndicators: z.array(z.string().trim().min(1).max(240)).max(128).default([]),
    monitoringCadenceDays: z.number().int().positive().max(3_650).default(90),
    governancePolicyId: z.string().min(1).optional(),
    governanceApprovalId: z.string().min(1).optional(),
    status: z.enum(canopyProofProjectStatuses).default("submitted"),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

const projectStatusSchema = z
  .object({
    status: z.enum(canopyProofProjectStatuses),
    rationale: z.string().trim().min(12).max(2_000),
    governanceApprovalId: z.string().min(1).optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

const projectMonitoringEventSchema = z
  .object({
    id: z.string().min(1).optional(),
    eventType: z.enum(canopyProofProjectMonitoringEventTypes),
    observedAt: z.string().datetime(),
    evidenceIds: z.array(z.string().trim().min(1).max(240)).max(256).default([]),
    terraSceneIds: z.array(z.string().trim().min(1).max(240)).max(256).default([]),
    biodiversityIndicators: z.array(z.string().trim().min(1).max(240)).max(128).default([]),
    waterIndicators: z.array(z.string().trim().min(1).max(240)).max(128).default([]),
    climateRiskIndicators: z.array(z.string().trim().min(1).max(240)).max(128).default([]),
    metrics: z.record(z.string().trim().min(1).max(120), z.number().finite()).default({}),
    state: z.enum(canopyProofProjectMonitoringStates).default("submitted"),
    rationale: z.string().trim().min(12).max(2_000),
  })
  .strict();

export class CanopyProofProjectRegistryService {
  private readonly projectsById = new Map<string, CanopyProofProjectProfile>();
  private readonly statusTransitionsById = new Map<string, CanopyProofProjectStatusTransition>();
  private readonly monitoringEventsById = new Map<string, CanopyProofProjectMonitoringEvent>();

  static fromAuthoritySnapshot(snapshot: CanopyProofProjectAuthoritySnapshot) {
    const service = new CanopyProofProjectRegistryService();
    const transitionIds = new Set<string>();
    const monitoringIds = new Set<string>();

    for (const project of snapshot.projects) {
      if (project.auditHistory.length !== 1) {
        throw new Error(`CanopyProof project snapshot registration history is not singular: ${project.id}`);
      }
      const replayed = service.registerProject(
        {
          id: project.id,
          organizationId: project.organizationId,
          title: project.title,
          projectType: project.projectType,
          regionId: project.regionId,
          location: project.location,
          targetTreeCount: project.targetTreeCount,
          biodiversityIndicators: project.biodiversityIndicators,
          waterIndicators: project.waterIndicators,
          climateRiskIndicators: project.climateRiskIndicators,
          monitoringCadenceDays: project.monitoringCadenceDays,
          ...(project.governancePolicyId ? { governancePolicyId: project.governancePolicyId } : {}),
          ...(project.governanceApprovalId ? { governanceApprovalId: project.governanceApprovalId } : {}),
          status: project.status,
          createdAt: project.createdAt,
        },
        project.createdBy,
        project.createdByRole,
      );
      assertProjectSnapshotEqual(replayed, project, "registration");
    }

    const factsByProject = new Map<
      string,
      Array<
        | Readonly<{ kind: "transition"; value: CanopyProofProjectStatusTransition }>
        | Readonly<{ kind: "monitoring"; value: CanopyProofProjectMonitoringEvent }>
      >
    >();
    for (const transition of snapshot.statusTransitions ?? []) {
      if (transitionIds.has(transition.id)) {
        throw new Error(`CanopyProof project snapshot contains duplicate status transition: ${transition.id}`);
      }
      transitionIds.add(transition.id);
      const entries = factsByProject.get(transition.projectId) ?? [];
      entries.push({ kind: "transition", value: transition });
      factsByProject.set(transition.projectId, entries);
    }
    for (const monitoring of snapshot.monitoringEvents ?? []) {
      if (monitoringIds.has(monitoring.id)) {
        throw new Error(`CanopyProof project snapshot contains duplicate monitoring event: ${monitoring.id}`);
      }
      monitoringIds.add(monitoring.id);
      const entries = factsByProject.get(monitoring.projectId) ?? [];
      entries.push({ kind: "monitoring", value: monitoring });
      factsByProject.set(monitoring.projectId, entries);
    }

    for (const [projectId, facts] of factsByProject) {
      let previousRoot = service.getProject(projectId).auditHistory.at(-1)?.eventRoot;
      const remaining = [...facts];
      while (remaining.length > 0) {
        const index = remaining.findIndex((entry) => entry.value.auditEvent.previousRoot === previousRoot);
        if (index < 0) {
          throw new Error(`CanopyProof project snapshot contains a forked or incomplete event chain: ${projectId}`);
        }
        const [entry] = remaining.splice(index, 1);
        if (!entry) throw new Error(`CanopyProof project snapshot replay failed: ${projectId}`);
        if (entry.kind === "transition") {
          const project = service.updateProjectStatus(
            projectId,
            {
              status: entry.value.status,
              rationale: entry.value.rationale,
              ...(entry.value.governanceApprovalId
                ? { governanceApprovalId: entry.value.governanceApprovalId }
                : {}),
              updatedAt: entry.value.updatedAt,
            },
            entry.value.updatedBy,
            entry.value.updaterRole,
          );
          const replayed = service.getProjectStatusTransition(entry.value.id);
          assertProjectStatusTransitionSnapshotEqual(replayed, entry.value);
          if (project.projectRoot !== entry.value.transitionRoot) {
            throw new Error(`CanopyProof project snapshot transition projection root is invalid: ${entry.value.id}`);
          }
        } else {
          const replayed = service.recordMonitoringEvent(
            projectId,
            {
              id: entry.value.id,
              eventType: entry.value.eventType,
              observedAt: entry.value.observedAt,
              evidenceIds: entry.value.evidenceIds,
              terraSceneIds: entry.value.terraSceneIds,
              biodiversityIndicators: entry.value.biodiversityIndicators,
              waterIndicators: entry.value.waterIndicators,
              climateRiskIndicators: entry.value.climateRiskIndicators,
              metrics: entry.value.metrics,
              state: entry.value.state,
              rationale: entry.value.rationale,
            },
            entry.value.observedBy,
            entry.value.observerRole,
          );
          assertProjectMonitoringSnapshotEqual(replayed, entry.value);
        }
        previousRoot = entry.value.auditEvent.eventRoot;
      }
    }
    return service;
  }

  registerProject(
    input: unknown,
    actorId: string,
    createdByRole: "owner" | "admin" | "verifier" = "verifier",
  ) {
    const parsed = projectRegistrationSchema.parse(input);
    assertSafeProjectText([
      parsed.organizationId,
      parsed.title,
      parsed.regionId,
      parsed.governancePolicyId ?? "",
      parsed.governanceApprovalId ?? "",
      ...parsed.biodiversityIndicators,
      ...parsed.waterIndicators,
      ...parsed.climateRiskIndicators,
    ]);
    if (["active", "monitored"].includes(parsed.status) && !parsed.governanceApprovalId) {
      throw new Error("CanopyProof project cannot become active or monitored without governance approval.");
    }

    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const location = normalizeProjectLocation(parsed.location);
    const createdSeed = {
      organizationId: parsed.organizationId,
      title: parsed.title,
      projectType: parsed.projectType,
      regionId: parsed.regionId,
      location,
      targetTreeCount: parsed.targetTreeCount,
      biodiversityIndicators: normalizeStringSet(parsed.biodiversityIndicators),
      waterIndicators: normalizeStringSet(parsed.waterIndicators),
      climateRiskIndicators: normalizeStringSet(parsed.climateRiskIndicators),
      monitoringCadenceDays: parsed.monitoringCadenceDays,
      governancePolicyId: parsed.governancePolicyId ?? null,
      governanceApprovalId: parsed.governanceApprovalId ?? null,
      status: parsed.status,
      createdAt,
    };
    const candidateHash = hashJson({ kind: "canopyproof-project-profile-candidate-v1", ...createdSeed });
    const projectId = parsed.id ?? `cp_project_${candidateHash.slice(0, 24)}`;
    const claimBoundary = canopyProofProjectClaimBoundary();
    const projectHash = hashJson({
      kind: "canopyproof-project-profile-v2",
      id: projectId,
      ...createdSeed,
      createdBy: actorId,
      createdByRole,
      claimBoundary,
    });
    const projectRoot = hashJson({
      kind: "canopyproof-project-root-v1",
      organizationId: parsed.organizationId,
      projectHash,
      boundaryHash: location.boundaryHash ?? null,
    });
    const existing = this.projectsById.get(projectId);
    if (existing) {
      if (existing.projectHash === projectHash && existing.projectRoot === projectRoot) return existing;
      throw new Error(`CanopyProof project already exists with conflicting payload: ${projectId}`);
    }
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "project",
      entityId: projectId,
      payload: {
        id: projectId,
        ...createdSeed,
        createdBy: actorId,
        createdByRole,
        projectHash,
        projectRoot,
        claimBoundary,
      },
      createdAt,
      rationale: "CanopyProof project registered as a bounded environmental accountability record.",
    });
    const project: CanopyProofProjectProfile = {
      id: projectId,
      organizationId: parsed.organizationId,
      title: parsed.title,
      projectType: parsed.projectType,
      regionId: parsed.regionId,
      location,
      targetTreeCount: parsed.targetTreeCount,
      biodiversityIndicators: createdSeed.biodiversityIndicators,
      waterIndicators: createdSeed.waterIndicators,
      climateRiskIndicators: createdSeed.climateRiskIndicators,
      monitoringCadenceDays: parsed.monitoringCadenceDays,
      ...(parsed.governancePolicyId ? { governancePolicyId: parsed.governancePolicyId } : {}),
      ...(parsed.governanceApprovalId ? { governanceApprovalId: parsed.governanceApprovalId } : {}),
      status: parsed.status,
      createdAt,
      updatedAt: createdAt,
      createdBy: actorId,
      createdByRole,
      projectHash,
      projectRoot,
      auditHistory,
      claimBoundary,
    };
    this.projectsById.set(project.id, project);
    return project;
  }

  updateProjectStatus(
    projectId: string,
    input: unknown,
    actorId: string,
    updaterRole: "owner" | "admin" | "verifier" = "verifier",
  ) {
    const project = this.getProject(projectId);
    const parsed = projectStatusSchema.parse(input);
    assertSafeProjectText([parsed.rationale, parsed.governanceApprovalId ?? ""]);
    assertProjectStatusTransition(project.status, parsed.status);
    if (["active", "monitored"].includes(parsed.status) && !(parsed.governanceApprovalId ?? project.governanceApprovalId)) {
      throw new Error("CanopyProof project active/monitored transition requires governance approval.");
    }
    if (
      !["active", "monitored"].includes(parsed.status) &&
      parsed.governanceApprovalId !== undefined &&
      parsed.governanceApprovalId !== project.governanceApprovalId
    ) {
      throw new Error("CanopyProof project governance approval can only be introduced by an active/monitored transition.");
    }
    const updatedAt = parsed.updatedAt ?? new Date(0).toISOString();
    if (Date.parse(updatedAt) <= Date.parse(project.updatedAt)) {
      throw new Error("CanopyProof project status transition must occur after the current project event.");
    }
    const transitionSeed = {
      projectId: project.id,
      organizationId: project.organizationId,
      previousStatus: project.status,
      status: parsed.status,
      previousProjectRoot: project.projectRoot,
      governanceApprovalId: parsed.governanceApprovalId ?? project.governanceApprovalId ?? null,
      rationale: parsed.rationale,
      updatedBy: actorId,
      updaterRole,
      updatedAt,
    };
    const transitionHash = hashJson({ kind: "canopyproof-project-status-transition-v1", ...transitionSeed });
    const transitionRoot = hashJson({
      kind: "canopyproof-project-status-transition-root-v1",
      previousProjectRoot: project.projectRoot,
      transitionHash,
    });
    const transitionId = `cp_project_transition_${transitionHash.slice(0, 24)}`;
    const existing = this.statusTransitionsById.get(transitionId);
    if (existing) {
      if (existing.transitionHash === transitionHash && existing.transitionRoot === transitionRoot) {
        return this.getProject(projectId);
      }
      throw new Error(`CanopyProof project status transition already exists with conflicting payload: ${transitionId}`);
    }
    const auditHistory = appendCanopyProofAuditEvent(project.auditHistory, {
      action: parsed.status === "challenged" ? "CHALLENGE" : "FULFILL",
      actor: actorId,
      entityType: "project_status_transition",
      entityId: transitionId,
      payload: { ...transitionSeed, transitionHash, transitionRoot },
      createdAt: updatedAt,
      rationale: parsed.rationale,
    });
    const auditEvent = auditHistory.at(-1);
    if (!auditEvent) throw new Error("CanopyProof project status transition failed to append audit history.");
    const transition: CanopyProofProjectStatusTransition = {
      id: transitionId,
      projectId: project.id,
      organizationId: project.organizationId,
      previousStatus: project.status,
      status: parsed.status,
      previousProjectRoot: project.projectRoot,
      ...(transitionSeed.governanceApprovalId
        ? { governanceApprovalId: transitionSeed.governanceApprovalId }
        : {}),
      rationale: parsed.rationale,
      updatedBy: actorId,
      updaterRole,
      updatedAt,
      transitionHash,
      transitionRoot,
      auditEvent,
    };
    const nextProject = {
      ...project,
      status: parsed.status,
      ...(parsed.governanceApprovalId ? { governanceApprovalId: parsed.governanceApprovalId } : {}),
      updatedAt,
      projectRoot: transitionRoot,
      auditHistory,
    };
    const updated: CanopyProofProjectProfile = nextProject;
    this.statusTransitionsById.set(transition.id, transition);
    this.projectsById.set(updated.id, updated);
    return updated;
  }

  listProjectStatusTransitions(projectId?: string) {
    return [...this.statusTransitionsById.values()]
      .filter((transition) => !projectId || transition.projectId === projectId)
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
  }

  getProjectStatusTransition(transitionId: string) {
    const transition = this.statusTransitionsById.get(transitionId);
    if (!transition) throw new Error(`CanopyProof project status transition not found: ${transitionId}`);
    return transition;
  }

  listProjects(filter: Partial<Pick<CanopyProofProjectProfile, "organizationId" | "regionId" | "projectType" | "status">> = {}) {
    return [...this.projectsById.values()]
      .filter((project) => !filter.organizationId || project.organizationId === filter.organizationId)
      .filter((project) => !filter.regionId || project.regionId === filter.regionId)
      .filter((project) => !filter.projectType || project.projectType === filter.projectType)
      .filter((project) => !filter.status || project.status === filter.status)
      .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
  }

  getProject(projectId: string) {
    const project = this.projectsById.get(projectId);
    if (!project) {
      throw new Error(`CanopyProof project not found: ${projectId}`);
    }
    return project;
  }

  recordMonitoringEvent(
    projectId: string,
    input: unknown,
    actorId: string,
    observerRole: "owner" | "admin" | "verifier" | "researcher" = "researcher",
  ) {
    const project = this.getProject(projectId);
    const parsed = projectMonitoringEventSchema.parse(input);
    assertSafeProjectText([
      parsed.eventType,
      parsed.rationale,
      ...parsed.evidenceIds,
      ...parsed.terraSceneIds,
      ...parsed.biodiversityIndicators,
      ...parsed.waterIndicators,
      ...parsed.climateRiskIndicators,
      ...Object.keys(parsed.metrics),
    ]);
    if (parsed.evidenceIds.length === 0 && parsed.terraSceneIds.length === 0) {
      throw new Error("CanopyProof monitoring events require evidenceIds or terraSceneIds.");
    }
    if (project.status === "archived") {
      throw new Error("CanopyProof archived project cannot accept monitoring events.");
    }
    if (parsed.state === "accepted" && !["active", "monitored"].includes(project.status)) {
      throw new Error("CanopyProof accepted monitoring requires an active or monitored project.");
    }
    if (Date.parse(parsed.observedAt) <= Date.parse(project.updatedAt)) {
      throw new Error("CanopyProof monitoring event must occur after the current project event.");
    }

    const projectStatus: CanopyProofProjectStatus =
      parsed.state === "challenged"
        ? "challenged"
        : parsed.state === "accepted" && project.status === "active"
          ? "monitored"
          : project.status;
    const eventSeed = {
      projectId: project.id,
      organizationId: project.organizationId,
      eventType: parsed.eventType,
      observedAt: parsed.observedAt,
      observedBy: actorId,
      observerRole,
      previousStatus: project.status,
      projectStatus,
      evidenceIds: normalizeStringSet(parsed.evidenceIds),
      terraSceneIds: normalizeStringSet(parsed.terraSceneIds),
      biodiversityIndicators: normalizeStringSet(parsed.biodiversityIndicators),
      waterIndicators: normalizeStringSet(parsed.waterIndicators),
      climateRiskIndicators: normalizeStringSet(parsed.climateRiskIndicators),
      metrics: normalizeMonitoringMetrics(parsed.metrics),
      state: parsed.state,
      rationale: parsed.rationale,
      previousProjectRoot: project.projectRoot,
    };
    const eventHash = hashJson({ kind: "canopyproof-project-monitoring-event-v2", ...eventSeed });
    const monitoringRoot = hashJson({
      kind: "canopyproof-project-monitoring-root-v1",
      previousProjectRoot: project.projectRoot,
      eventHash,
    });
    const derivedEventId = `cp_project_monitoring_${eventHash.slice(0, 24)}`;
    if (parsed.id && parsed.id !== derivedEventId) {
      throw new Error("CanopyProof project monitoring event id must match its canonical content hash.");
    }
    const eventId = derivedEventId;
    const existing = this.monitoringEventsById.get(eventId);
    if (existing) {
      if (existing.eventHash === eventHash && existing.monitoringRoot === monitoringRoot) return existing;
      throw new Error(`CanopyProof project monitoring event already exists with conflicting payload: ${eventId}`);
    }
    const auditHistory = appendCanopyProofAuditEvent(project.auditHistory, {
      action: parsed.state === "challenged" ? "CHALLENGE" : "ASSERT",
      actor: actorId,
      entityType: "project_monitoring_event",
      entityId: eventId,
      payload: { monitoringEventId: eventId, ...eventSeed, eventHash, monitoringRoot },
      createdAt: parsed.observedAt,
      rationale: parsed.rationale,
    });
    const auditEvent = auditHistory.at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof project monitoring event failed to append audit history.");
    }
    const updatedProject = {
      ...project,
      status: projectStatus,
      updatedAt: parsed.observedAt,
      projectRoot: monitoringRoot,
      auditHistory,
    };
    this.projectsById.set(project.id, updatedProject);

    const event: CanopyProofProjectMonitoringEvent = {
      id: eventId,
      projectId: project.id,
      organizationId: project.organizationId,
      eventType: parsed.eventType,
      observedAt: parsed.observedAt,
      observedBy: actorId,
      observerRole,
      previousStatus: project.status,
      projectStatus,
      previousProjectRoot: project.projectRoot,
      evidenceIds: eventSeed.evidenceIds,
      terraSceneIds: eventSeed.terraSceneIds,
      biodiversityIndicators: eventSeed.biodiversityIndicators,
      waterIndicators: eventSeed.waterIndicators,
      climateRiskIndicators: eventSeed.climateRiskIndicators,
      metrics: eventSeed.metrics,
      state: parsed.state,
      rationale: parsed.rationale,
      eventHash,
      monitoringRoot,
      auditEvent,
    };
    this.monitoringEventsById.set(event.id, event);
    return event;
  }

  listMonitoringEvents(
    filter: Readonly<{
      projectId?: string;
      state?: CanopyProofProjectMonitoringState;
      eventType?: CanopyProofProjectMonitoringEventType;
    }> = {},
  ) {
    return [...this.monitoringEventsById.values()]
      .filter((event) => !filter.projectId || event.projectId === filter.projectId)
      .filter((event) => !filter.state || event.state === filter.state)
      .filter((event) => !filter.eventType || event.eventType === filter.eventType)
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt) || left.id.localeCompare(right.id));
  }

  getMonitoringEvent(eventId: string) {
    const event = this.monitoringEventsById.get(eventId);
    if (!event) {
      throw new Error(`CanopyProof project monitoring event not found: ${eventId}`);
    }
    return event;
  }

  getStatus(): CanopyProofProjectRegistryStatus {
    const projects = this.listProjects();
    const monitoringEvents = this.listMonitoringEvents();
    return {
      service: "canopyproof-project-registry",
      projectCount: projects.length,
      activeProjectCount: projects.filter((project) => project.status === "active" || project.status === "monitored").length,
      challengedProjectCount: projects.filter((project) => project.status === "challenged").length,
      statusTransitionCount: this.statusTransitionsById.size,
      monitoringEventCount: monitoringEvents.length,
      challengedMonitoringEventCount: monitoringEvents.filter((event) => event.state === "challenged").length,
      projectRoot:
        projects.length > 0
          ? merkleRoot(projects.map((project) => project.projectRoot).sort())
          : hashJson({ kind: "canopyproof-empty-project-root-v1" }),
      monitoringRoot:
        monitoringEvents.length > 0
          ? merkleRoot(monitoringEvents.map((event) => event.eventHash).sort())
          : hashJson({ kind: "canopyproof-empty-project-monitoring-root-v1" }),
      supportedProjectTypes: canopyProofProjectTypes,
      supportedStatuses: canopyProofProjectStatuses,
      supportedMonitoringEventTypes: canopyProofProjectMonitoringEventTypes,
      supportedMonitoringStates: canopyProofProjectMonitoringStates,
      safety: {
        projectsAreAudited: true,
        monitoringEventsAreAudited: true,
        publicClaimsBounded: true,
        activeStatusRequiresGovernanceApproval: true,
        noFinancialOrCarbonCreditClaims: true,
      },
    };
  }
}

function normalizeMonitoringMetrics(metrics: Record<string, number>) {
  return Object.fromEntries(Object.entries(metrics).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeStringSet(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()))].sort();
}

export function canopyProofProjectClaimBoundary(): CanopyProofProjectClaimBoundary {
  return {
    restorationProjectRegistryOnly: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
    disclosure:
      "This project profile is an environmental accountability registry record. It is not a certified carbon credit, carbon-tax offset, financial asset, guaranteed yield instrument, mainnet-fund movement, or automatic CANOPY distribution claim.",
  };
}

function assertSafeProjectText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) {
    throw new Error(`CanopyProof project registry input contains unsupported public claim: ${unsafe}`);
  }
}

function normalizeProjectLocation(location: z.infer<typeof projectLocationSchema>): CanopyProofProjectLocation {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    areaHectares: location.areaHectares,
    ...(location.boundaryHash ? { boundaryHash: location.boundaryHash.replace(/^sha256:/i, "").toLowerCase() } : {}),
  };
}

function assertProjectStatusTransition(previous: CanopyProofProjectStatus, next: CanopyProofProjectStatus) {
  const allowed: Readonly<Record<CanopyProofProjectStatus, readonly CanopyProofProjectStatus[]>> = {
    submitted: ["under_review", "challenged", "suspended", "archived"],
    under_review: ["active", "challenged", "suspended", "archived"],
    active: ["monitored", "challenged", "suspended", "archived"],
    monitored: ["monitored", "challenged", "suspended", "archived"],
    challenged: ["under_review", "suspended", "archived"],
    suspended: ["under_review", "archived"],
    archived: [],
  };
  if (!allowed[previous].includes(next)) {
    throw new Error(`CanopyProof project cannot transition from ${previous} to ${next}.`);
  }
}

function assertProjectSnapshotEqual(
  actual: CanopyProofProjectProfile,
  expected: CanopyProofProjectProfile,
  boundary: string,
) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof project snapshot ${boundary} hash lineage is invalid: ${expected.id}`);
  }
}

function assertProjectStatusTransitionSnapshotEqual(
  actual: CanopyProofProjectStatusTransition,
  expected: CanopyProofProjectStatusTransition,
) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof project snapshot status transition hash lineage is invalid: ${expected.id}`);
  }
}

function assertProjectMonitoringSnapshotEqual(
  actual: CanopyProofProjectMonitoringEvent,
  expected: CanopyProofProjectMonitoringEvent,
) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof project snapshot monitoring hash lineage is invalid: ${expected.id}`);
  }
}
