import { createProjectMilestoneSchema, createProjectSchema } from "@dropin/schemas";
import type { Project } from "@dropin/schemas";
import { ProjectNotFoundError } from "./impact-errors.js";
import type { ImpactRepository } from "./impact-repository.js";
import { assertProjectTransition } from "./impact-state-machine.js";

export class ImpactService {
  constructor(private readonly repo: ImpactRepository) {}

  listProjects() {
    return this.repo.listProjects();
  }

  async getProjectDetail(projectId: string) {
    const detail = await this.repo.getProjectDetail(projectId);
    if (!detail) {
      throw new ProjectNotFoundError(projectId);
    }
    return detail;
  }

  async createProject(input: unknown, actor = "api-admin") {
    const parsed = createProjectSchema.parse(input);
    const project = await this.repo.createProject(parsed);
    await this.repo.createAuditLog({
      actor,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      afterState: project,
    });
    return project;
  }

  async createMilestone(projectId: string, input: unknown, actor = "api-admin") {
    const project = await this.mustGetProject(projectId);
    const parsed = createProjectMilestoneSchema.parse(input);
    const milestone = await this.repo.createMilestone(project.id, parsed);
    await this.repo.createAuditLog({
      actor,
      action: "project_milestone.create",
      entityType: "project_milestone",
      entityId: milestone.id,
      afterState: milestone,
    });
    return milestone;
  }

  async approveProject(projectId: string, actor = "api-admin") {
    return this.transitionProject(projectId, "approved", "project.approve", actor);
  }

  async fundProject(projectId: string, actor = "api-admin") {
    return this.transitionProject(projectId, "funded", "project.fund", actor);
  }

  async releaseMilestone(projectId: string, input: unknown, actor = "api-admin") {
    const body = zMilestoneRelease.parse(input);
    const detail = await this.getProjectDetail(projectId);
    const milestone = detail.milestones.find((item) => item.id === body.milestoneId) ?? detail.milestones[0];
    if (!milestone) {
      throw new Error(`No milestone available for project: ${projectId}`);
    }
    const updatedMilestone = await this.repo.updateMilestoneStatus(milestone.id, "released");
    const updatedProject = await this.transitionProject(projectId, "milestone_1_released", "project.release_milestone", actor);
    await this.repo.createAuditLog({
      actor,
      action: "project_milestone.release",
      entityType: "project_milestone",
      entityId: milestone.id,
      beforeState: milestone,
      afterState: updatedMilestone,
    });
    return {
      project: updatedProject,
      milestone: updatedMilestone,
    };
  }

  private async transitionProject(projectId: string, status: Project["status"], action: string, actor: string) {
    const project = await this.mustGetProject(projectId);
    if (project.status !== status) {
      assertProjectTransition(project.status, status);
    }
    const updated = await this.repo.updateProject({
      ...project,
      status,
    });
    await this.repo.createAuditLog({
      actor,
      action,
      entityType: "project",
      entityId: projectId,
      beforeState: project,
      afterState: updated,
    });
    return updated;
  }

  private async mustGetProject(projectId: string) {
    const project = await this.repo.getProject(projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return project;
  }
}

const zMilestoneRelease = {
  parse(input: unknown): { milestoneId?: string } {
    if (typeof input !== "object" || input === null) {
      return {};
    }
    const milestoneId = (input as { milestoneId?: unknown }).milestoneId;
    return typeof milestoneId === "string" ? { milestoneId } : {};
  },
};
