import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { merkleRoot } from "@dropin/crypto";
import type {
  AuditLog,
  ChallengeCase,
  EvidenceObject,
  ImpactCertificate,
  Project,
  ProjectMilestone,
} from "@dropin/schemas";
import type { AuditInput } from "../lottery/lottery-repository.js";

export type ProjectDetail = {
  project: Project;
  milestones: ProjectMilestone[];
  evidence: EvidenceObject[];
  certificates: ImpactCertificate[];
};

export type CreateProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;
export type CreateMilestoneInput = Omit<ProjectMilestone, "id" | "projectId" | "createdAt">;
export type CreateEvidenceInput = Omit<EvidenceObject, "id" | "createdAt" | "updatedAt">;
export type CreateCertificateInput = ImpactCertificate & {
  evidenceIds: string[];
};

export interface ImpactRepository {
  makeId(prefix: string): string;
  now(): string;
  listProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project | undefined>;
  getProjectDetail(projectId: string): Promise<ProjectDetail | undefined>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(project: Project): Promise<Project>;
  createMilestone(projectId: string, input: CreateMilestoneInput): Promise<ProjectMilestone>;
  updateMilestoneStatus(milestoneId: string, status: ProjectMilestone["status"]): Promise<ProjectMilestone>;
  createEvidence(input: CreateEvidenceInput): Promise<EvidenceObject>;
  getEvidence(evidenceId: string): Promise<EvidenceObject | undefined>;
  listEvidence(): Promise<EvidenceObject[]>;
  updateEvidenceStatus(evidenceId: string, status: EvidenceObject["status"]): Promise<EvidenceObject>;
  createCertificate(input: CreateCertificateInput): Promise<ImpactCertificate>;
  getCertificate(certificateId: string): Promise<ImpactCertificate | undefined>;
  listCertificates(): Promise<ImpactCertificate[]>;
  updateCertificateStatus(certificateId: string, status: ImpactCertificate["status"]): Promise<ImpactCertificate>;
  createChallenge(input: Omit<ChallengeCase, "id" | "createdAt" | "updatedAt">): Promise<ChallengeCase>;
  listChallenges(): Promise<ChallengeCase[]>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export class InMemoryImpactRepository implements ImpactRepository {
  readonly projects = new Map<string, Project>();
  readonly milestones = new Map<string, ProjectMilestone>();
  readonly evidence = new Map<string, EvidenceObject>();
  readonly certificates = new Map<string, ImpactCertificate>();
  readonly certificateEvidence = new Map<string, string[]>();
  readonly challenges = new Map<string, ChallengeCase>();
  readonly auditLogs: AuditLog[] = [];

  constructor(seed = true) {
    if (seed) {
      this.seed();
    }
  }

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async listProjects() {
    return [...this.projects.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getProject(projectId: string) {
    return this.projects.get(projectId);
  }

  async getProjectDetail(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project) {
      return undefined;
    }
    return {
      project,
      milestones: [...this.milestones.values()].filter((milestone) => milestone.projectId === projectId),
      evidence: [...this.evidence.values()].filter((evidence) => evidence.projectId === projectId),
      certificates: [...this.certificates.values()].filter((certificate) => certificate.projectId === projectId),
    };
  }

  async createProject(input: CreateProjectInput) {
    const createdAt = this.now();
    const project: Project = {
      ...input,
      id: this.makeId("project"),
      createdAt,
      updatedAt: createdAt,
    };
    this.projects.set(project.id, project);
    return project;
  }

  async updateProject(project: Project) {
    const updated = { ...project, updatedAt: this.now() };
    this.projects.set(project.id, updated);
    return updated;
  }

  async createMilestone(projectId: string, input: CreateMilestoneInput) {
    const milestone: ProjectMilestone = {
      ...input,
      id: this.makeId("milestone"),
      projectId,
      createdAt: this.now(),
    };
    this.milestones.set(milestone.id, milestone);
    return milestone;
  }

  async updateMilestoneStatus(milestoneId: string, status: ProjectMilestone["status"]) {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }
    const updated: ProjectMilestone = { ...milestone, status };
    this.milestones.set(milestoneId, updated);
    return updated;
  }

  async createEvidence(input: CreateEvidenceInput) {
    const createdAt = this.now();
    const evidence: EvidenceObject = {
      ...input,
      id: this.makeId("evidence"),
      createdAt,
      updatedAt: createdAt,
    };
    this.evidence.set(evidence.id, evidence);
    return evidence;
  }

  async getEvidence(evidenceId: string) {
    return this.evidence.get(evidenceId);
  }

  async listEvidence() {
    return [...this.evidence.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateEvidenceStatus(evidenceId: string, status: EvidenceObject["status"]) {
    const evidence = this.evidence.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    const updated = { ...evidence, status, updatedAt: this.now() };
    this.evidence.set(evidenceId, updated);
    return updated;
  }

  async createCertificate(input: CreateCertificateInput) {
    const { evidenceIds, ...certificate } = input;
    this.certificates.set(certificate.id, certificate);
    this.certificateEvidence.set(certificate.id, evidenceIds);
    return certificate;
  }

  async getCertificate(certificateId: string) {
    return this.certificates.get(certificateId);
  }

  async listCertificates() {
    return [...this.certificates.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateCertificateStatus(certificateId: string, status: ImpactCertificate["status"]) {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }
    const updated: ImpactCertificate = { ...certificate, status };
    this.certificates.set(certificateId, updated);
    return updated;
  }

  async createChallenge(input: Omit<ChallengeCase, "id" | "createdAt" | "updatedAt">) {
    const now = this.now();
    const challenge: ChallengeCase = {
      ...input,
      id: this.makeId("challenge"),
      createdAt: now,
      updatedAt: now,
    };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  async listChallenges() {
    return [...this.challenges.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createAuditLog(input: AuditInput) {
    const auditLog: AuditLog = {
      id: this.makeId("audit"),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      requestId: input.requestId,
      createdAt: this.now(),
    };
    this.auditLogs.push(auditLog);
    return auditLog;
  }

  async listAuditLogs() {
    return [...this.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private seed() {
    const now = this.now();
    const project: Project = {
      id: "project_v1_ggw_demo",
      title: "Great Green Wall Demo Project",
      regionId: "region_ggw_sahel",
      operator: "Great Green Wall Local Operator",
      targetTreeCount: 10000,
      targetSpecies: ["Faidherbia albida", "Acacia senegal"],
      budgetAmount: "25000",
      status: "approved",
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    const milestone: ProjectMilestone = {
      id: "milestone_v1_ggw_demo_1",
      projectId: project.id,
      title: "Plant first 1,000 drought-resistant trees",
      amount: "2500",
      status: "approved",
      createdAt: now,
    };
    this.milestones.set(milestone.id, milestone);
    const evidenceOne: EvidenceObject = {
      id: "evidence_v1_ggw_demo_photo",
      projectId: project.id,
      treeClusterId: "cluster_v1_ggw_demo",
      kind: "photo",
      uri: "r2://dropin/evidence/ggw-photo-001.jpg",
      sha256Hash: "a".repeat(64),
      submittedBy: "validator_ggw_1",
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    };
    const evidenceTwo: EvidenceObject = {
      id: "evidence_v1_ggw_demo_gps",
      projectId: project.id,
      treeClusterId: "cluster_v1_ggw_demo",
      kind: "gps",
      uri: "r2://dropin/evidence/ggw-gps-001.json",
      sha256Hash: "b".repeat(64),
      submittedBy: "validator_ggw_1",
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    };
    this.evidence.set(evidenceOne.id, evidenceOne);
    this.evidence.set(evidenceTwo.id, evidenceTwo);
    const evidenceRoot = merkleRoot([evidenceOne.sha256Hash, evidenceTwo.sha256Hash].sort());
    const certificate: ImpactCertificate = {
      id: "cert_v1_ggw_demo",
      projectId: project.id,
      treeClusterId: "cluster_v1_ggw_demo",
      regionId: project.regionId,
      certificateLevel: "impact_certificate",
      evidenceRoot,
      methodologyVersion: "impact-v1-pre-mrv",
      verifiedTreeCount: 800,
      survivalRateEstimate: 0.72,
      estimatedCo2eLow: "120",
      estimatedCo2eHigh: "210",
      confidenceScore: 72,
      validatorSignatures: ["validator_sig_ggw_1"],
      status: "issued",
      issuedAt: now,
      createdAt: now,
    };
    this.certificates.set(certificate.id, certificate);
    this.certificateEvidence.set(certificate.id, [evidenceOne.id, evidenceTwo.id]);
  }
}

export class PrismaImpactRepository implements ImpactRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async listProjects() {
    const projects = await this.prisma.project.findMany({ orderBy: { createdAt: "desc" } });
    return projects.map(toProject);
  }

  async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    return project ? toProject(project) : undefined;
  }

  async getProjectDetail(projectId: string) {
    const detail = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: { createdAt: "asc" } },
        evidenceObjects: { orderBy: { createdAt: "desc" } },
        certificates: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!detail) {
      return undefined;
    }
    return {
      project: toProject(detail),
      milestones: detail.milestones.map(toMilestone),
      evidence: detail.evidenceObjects.map(toEvidence),
      certificates: detail.certificates.map(toCertificate),
    };
  }

  async createProject(input: CreateProjectInput) {
    const created = await this.prisma.project.create({
      data: {
        id: this.makeId("project"),
        title: input.title,
        regionId: input.regionId,
        operator: input.operator,
        targetTreeCount: input.targetTreeCount,
        targetSpecies: input.targetSpecies,
        budgetAmount: input.budgetAmount,
        status: input.status,
      },
    });
    return toProject(created);
  }

  async updateProject(project: Project) {
    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        title: project.title,
        operator: project.operator,
        targetTreeCount: project.targetTreeCount,
        targetSpecies: project.targetSpecies,
        budgetAmount: project.budgetAmount,
        status: project.status,
      },
    });
    return toProject(updated);
  }

  async createMilestone(projectId: string, input: CreateMilestoneInput) {
    const created = await this.prisma.projectMilestone.create({
      data: {
        id: this.makeId("milestone"),
        projectId,
        title: input.title,
        amount: input.amount,
        status: input.status,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
    });
    return toMilestone(created);
  }

  async updateMilestoneStatus(milestoneId: string, status: ProjectMilestone["status"]) {
    const updated = await this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { status },
    });
    return toMilestone(updated);
  }

  async createEvidence(input: CreateEvidenceInput) {
    const created = await this.prisma.evidenceObject.create({
      data: {
        id: this.makeId("evidence"),
        projectId: input.projectId,
        treeClusterId: input.treeClusterId ?? null,
        kind: input.kind,
        uri: input.uri,
        sha256Hash: input.sha256Hash,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        submittedBy: input.submittedBy,
        status: input.status,
      },
    });
    return toEvidence(created);
  }

  async getEvidence(evidenceId: string) {
    const evidence = await this.prisma.evidenceObject.findUnique({ where: { id: evidenceId } });
    return evidence ? toEvidence(evidence) : undefined;
  }

  async listEvidence() {
    const evidence = await this.prisma.evidenceObject.findMany({ orderBy: { createdAt: "desc" } });
    return evidence.map(toEvidence);
  }

  async updateEvidenceStatus(evidenceId: string, status: EvidenceObject["status"]) {
    const updated = await this.prisma.evidenceObject.update({
      where: { id: evidenceId },
      data: { status },
    });
    return toEvidence(updated);
  }

  async createCertificate(input: CreateCertificateInput) {
    const { evidenceIds, ...certificate } = input;
    const created = await this.prisma.impactCertificate.create({
      data: {
        id: certificate.id,
        projectId: certificate.projectId,
        treeClusterId: certificate.treeClusterId,
        regionId: certificate.regionId,
        certificateLevel: certificate.certificateLevel,
        evidenceRoot: certificate.evidenceRoot,
        methodologyVersion: certificate.methodologyVersion,
        verifiedTreeCount: certificate.verifiedTreeCount,
        survivalRateEstimate: certificate.survivalRateEstimate,
        estimatedCo2eLow: certificate.estimatedCo2eLow,
        estimatedCo2eHigh: certificate.estimatedCo2eHigh,
        confidenceScore: certificate.confidenceScore,
        validatorSignatures: certificate.validatorSignatures,
        pqSignature: certificate.pqSignature ?? null,
        chainAnchorHash: certificate.chainAnchorHash ?? null,
        status: certificate.status,
        issuedAt: certificate.issuedAt ? new Date(certificate.issuedAt) : null,
        createdAt: new Date(certificate.createdAt),
        evidenceMap: {
          create: evidenceIds.map((evidenceId) => ({ evidenceId })),
        },
      },
    });
    return toCertificate(created);
  }

  async getCertificate(certificateId: string) {
    const certificate = await this.prisma.impactCertificate.findUnique({ where: { id: certificateId } });
    return certificate ? toCertificate(certificate) : undefined;
  }

  async listCertificates() {
    const certificates = await this.prisma.impactCertificate.findMany({ orderBy: { createdAt: "desc" } });
    return certificates.map(toCertificate);
  }

  async updateCertificateStatus(certificateId: string, status: ImpactCertificate["status"]) {
    const updated = await this.prisma.impactCertificate.update({
      where: { id: certificateId },
      data: { status },
    });
    return toCertificate(updated);
  }

  async createChallenge(input: Omit<ChallengeCase, "id" | "createdAt" | "updatedAt">) {
    const created = await this.prisma.challengeCase.create({
      data: {
        id: this.makeId("challenge"),
        targetType: input.targetType,
        targetId: input.targetId,
        challenger: input.challenger,
        severity: input.severity,
        title: input.title,
        attackScenario: input.attackScenario,
        evidenceHash: input.evidenceHash,
        bondAmount: input.bondAmount,
        status: input.status,
        result: input.result,
        rewardAmount: input.rewardAmount,
        protocolFix: input.protocolFix ?? null,
      },
    });
    return toChallenge(created);
  }

  async listChallenges() {
    const challenges = await this.prisma.challengeCase.findMany({ orderBy: { createdAt: "desc" } });
    return challenges.map(toChallenge);
  }

  async createAuditLog(input: AuditInput) {
    const created = await this.prisma.auditLog.create({
      data: {
        id: this.makeId("audit"),
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState === undefined ? null : JSON.parse(JSON.stringify(input.beforeState)),
        afterState: input.afterState === undefined ? null : JSON.parse(JSON.stringify(input.afterState)),
        requestId: input.requestId ?? null,
      },
    });
    return toAuditLog(created);
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } });
    return logs.map(toAuditLog);
  }
}

type PrismaProject = Awaited<ReturnType<PrismaClient["project"]["findFirst"]>>;
type PrismaMilestone = Awaited<ReturnType<PrismaClient["projectMilestone"]["findFirst"]>>;
type PrismaEvidence = Awaited<ReturnType<PrismaClient["evidenceObject"]["findFirst"]>>;
type PrismaCertificate = Awaited<ReturnType<PrismaClient["impactCertificate"]["findFirst"]>>;
type PrismaChallenge = Awaited<ReturnType<PrismaClient["challengeCase"]["findFirst"]>>;
type PrismaAuditLog = Awaited<ReturnType<PrismaClient["auditLog"]["findFirst"]>>;

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toProject(project: NonNullable<PrismaProject>): Project {
  return {
    id: project.id,
    title: project.title,
    regionId: project.regionId,
    operator: project.operator,
    targetTreeCount: project.targetTreeCount,
    targetSpecies: stringArray(project.targetSpecies),
    budgetAmount: project.budgetAmount.toString(),
    status: project.status as Project["status"],
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function toMilestone(milestone: NonNullable<PrismaMilestone>): ProjectMilestone {
  return {
    id: milestone.id,
    projectId: milestone.projectId,
    title: milestone.title,
    amount: milestone.amount.toString(),
    status: milestone.status as ProjectMilestone["status"],
    dueAt: milestone.dueAt?.toISOString(),
    createdAt: milestone.createdAt.toISOString(),
  };
}

function toEvidence(evidence: NonNullable<PrismaEvidence>): EvidenceObject {
  return {
    id: evidence.id,
    projectId: evidence.projectId,
    treeClusterId: evidence.treeClusterId ?? undefined,
    kind: evidence.kind as EvidenceObject["kind"],
    uri: evidence.uri,
    sha256Hash: evidence.sha256Hash,
    latitude: evidence.latitude === null ? undefined : Number(evidence.latitude),
    longitude: evidence.longitude === null ? undefined : Number(evidence.longitude),
    submittedBy: evidence.submittedBy,
    status: evidence.status as EvidenceObject["status"],
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString(),
  };
}

function toCertificate(certificate: NonNullable<PrismaCertificate>): ImpactCertificate {
  return {
    id: certificate.id,
    projectId: certificate.projectId,
    treeClusterId: certificate.treeClusterId,
    regionId: certificate.regionId,
    certificateLevel: certificate.certificateLevel as ImpactCertificate["certificateLevel"],
    evidenceRoot: certificate.evidenceRoot,
    methodologyVersion: certificate.methodologyVersion,
    verifiedTreeCount: certificate.verifiedTreeCount,
    survivalRateEstimate: Number(certificate.survivalRateEstimate),
    estimatedCo2eLow: certificate.estimatedCo2eLow.toString(),
    estimatedCo2eHigh: certificate.estimatedCo2eHigh.toString(),
    confidenceScore: certificate.confidenceScore,
    validatorSignatures: stringArray(certificate.validatorSignatures),
    pqSignature: certificate.pqSignature ?? undefined,
    chainAnchorHash: certificate.chainAnchorHash ?? undefined,
    status: certificate.status as ImpactCertificate["status"],
    issuedAt: certificate.issuedAt?.toISOString(),
    createdAt: certificate.createdAt.toISOString(),
  };
}

function toChallenge(challenge: NonNullable<PrismaChallenge>): ChallengeCase {
  return {
    id: challenge.id,
    targetType: challenge.targetType as ChallengeCase["targetType"],
    targetId: challenge.targetId,
    challenger: challenge.challenger,
    severity: challenge.severity as ChallengeCase["severity"],
    title: challenge.title,
    attackScenario: challenge.attackScenario,
    evidenceHash: challenge.evidenceHash,
    bondAmount: challenge.bondAmount.toString(),
    status: challenge.status as ChallengeCase["status"],
    result: challenge.result as ChallengeCase["result"],
    rewardAmount: challenge.rewardAmount.toString(),
    protocolFix: challenge.protocolFix ?? undefined,
    createdAt: challenge.createdAt.toISOString(),
    updatedAt: challenge.updatedAt.toISOString(),
  };
}

function toAuditLog(log: NonNullable<PrismaAuditLog>): AuditLog {
  return {
    id: log.id,
    actor: log.actor,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    beforeState: log.beforeState,
    afterState: log.afterState,
    requestId: log.requestId ?? undefined,
    createdAt: log.createdAt.toISOString(),
  };
}
