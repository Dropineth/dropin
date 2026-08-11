import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  type CanopyProofAhinAction,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofAgentIds = [
  "canopyproof-evidence-agent",
  "canopyproof-verification-agent",
  "canopyproof-esg-agent",
  "canopyproof-funding-agent",
  "canopyproof-risk-agent",
  "canopyproof-community-agent",
] as const;

export const canopyProofAgentTypes = ["evidence", "verification", "esg", "funding", "risk", "community"] as const;

export const canopyProofAgentSubjectTypes = [
  "evidence",
  "ai_analysis",
  "human_review",
  "proof_record",
  "terra_scene",
  "esg_report",
  "organization",
  "funding_allocation",
  "funding_milestone",
  "risk_alert",
  "system",
] as const;

export type CanopyProofAgentId = (typeof canopyProofAgentIds)[number];
export type CanopyProofAgentType = (typeof canopyProofAgentTypes)[number];
export type CanopyProofAgentSubjectType = (typeof canopyProofAgentSubjectTypes)[number];

export type CanopyProofAgentProfile = {
  readonly id: CanopyProofAgentId;
  readonly name: string;
  readonly agentType: CanopyProofAgentType;
  readonly layer: "Evidence" | "Verification" | "Governance" | "Impact";
  readonly capabilities: readonly string[];
  readonly allowedActions: readonly CanopyProofAhinAction[];
  readonly humanReviewRequired: boolean;
  readonly finalAuthority: false;
  readonly status: "active" | "paused" | "quarantined";
  readonly registryHash: string;
};

export type CanopyProofAgentEvent = {
  readonly id: string;
  readonly agentId: CanopyProofAgentId;
  readonly actorId: string;
  readonly action: CanopyProofAhinAction;
  readonly subjectType: CanopyProofAgentSubjectType;
  readonly subjectId: string;
  readonly payloadHash: string;
  readonly sourceRoot: string;
  readonly confidenceScore: number;
  readonly createdAt: string;
  readonly rationale: string;
  readonly humanReviewRequired: boolean;
  readonly finalAuthority: false;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofAgentFrameworkStatus = {
  readonly service: "canopyproof-agent-framework";
  readonly agentCount: number;
  readonly activeAgentCount: number;
  readonly eventCount: number;
  readonly agentRoot: string;
  readonly eventRoot: string;
  readonly actions: readonly CanopyProofAhinAction[];
  readonly subjectTypes: readonly CanopyProofAgentSubjectType[];
  readonly safety: {
    readonly aiNeverFinalAuthority: true;
    readonly humanReviewRequiredForProof: true;
    readonly noAutonomousCarbonCreditClaim: true;
  };
};

const agentEventSchema = z
  .object({
    agentId: z.enum(canopyProofAgentIds),
    action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
    subjectType: z.enum(canopyProofAgentSubjectTypes),
    subjectId: z.string().min(1),
    payload: z.unknown().default({}),
    sources: z.array(z.string().min(1)).min(1),
    confidenceScore: z.number().min(0).max(100).default(0),
    createdAt: z.string().datetime().optional(),
    rationale: z.string().min(1),
  })
  .strict();

export class CanopyProofAgentFrameworkService {
  private readonly agentsById = new Map<CanopyProofAgentId, CanopyProofAgentProfile>(
    defaultCanopyProofAgents().map((agent) => [agent.id, agent]),
  );
  private readonly eventsById = new Map<string, CanopyProofAgentEvent>();

  listAgents() {
    return [...this.agentsById.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  getAgent(agentId: string) {
    if (!canopyProofAgentIds.includes(agentId as CanopyProofAgentId)) {
      throw new Error(`CanopyProof agent not found: ${agentId}`);
    }
    const agent = this.agentsById.get(agentId as CanopyProofAgentId);
    if (!agent) {
      throw new Error(`CanopyProof agent not found: ${agentId}`);
    }
    return agent;
  }

  recordEvent(input: unknown, actorId: string) {
    const parsed = agentEventSchema.parse(input);
    const agent = this.getAgent(parsed.agentId);
    if (agent.status !== "active") {
      throw new Error(`CanopyProof agent is not active: ${agent.id}`);
    }
    if (!agent.allowedActions.includes(parsed.action)) {
      throw new Error(`CanopyProof agent ${agent.id} cannot emit action ${parsed.action}.`);
    }
    if (parsed.action === "FULFILL" && parsed.subjectType === "proof_record" && agent.id !== "canopyproof-verification-agent") {
      throw new Error("Only the Verification Agent can emit proof-record FULFILL events.");
    }
    assertSafeAgentText([parsed.subjectId, parsed.rationale, ...parsed.sources]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const sourceRoot = merkleRoot([...parsed.sources].sort());
    const payloadHash = hashJson(parsed.payload);
    const eventSeed = {
      agentId: agent.id,
      actorId,
      action: parsed.action,
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      payloadHash,
      sourceRoot,
      confidenceScore: parsed.confidenceScore,
      createdAt,
      rationale: parsed.rationale,
      humanReviewRequired: agent.humanReviewRequired || parsed.subjectType === "proof_record",
      finalAuthority: false,
    };
    const eventRoot = hashJson({ kind: "canopyproof-agent-event-v1", ...eventSeed });
    const eventId = `cp_agent_event_${eventRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(
      this.listEvents(agent.id).map((event) => event.auditEvent),
      {
        action: parsed.action,
        actor: actorId,
        entityType: "agent_event",
        entityId: eventId,
        payload: eventSeed,
        createdAt,
        rationale: parsed.rationale,
      },
    ).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof agent event failed to append audit event.");
    }
    const event: CanopyProofAgentEvent = {
      id: eventId,
      agentId: agent.id,
      actorId,
      action: parsed.action,
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      payloadHash,
      sourceRoot,
      confidenceScore: parsed.confidenceScore,
      createdAt,
      rationale: parsed.rationale,
      humanReviewRequired: eventSeed.humanReviewRequired,
      finalAuthority: false,
      auditEvent,
    };
    this.eventsById.set(event.id, event);
    return event;
  }

  listEvents(agentId?: string) {
    const events = [...this.eventsById.values()];
    const filtered = agentId ? events.filter((event) => event.agentId === agentId) : events;
    return filtered.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  getStatus(): CanopyProofAgentFrameworkStatus {
    const agents = this.listAgents();
    const events = this.listEvents();
    return {
      service: "canopyproof-agent-framework",
      agentCount: agents.length,
      activeAgentCount: agents.filter((agent) => agent.status === "active").length,
      eventCount: events.length,
      agentRoot: merkleRoot(agents.map((agent) => agent.registryHash).sort()),
      eventRoot: events.length > 0 ? merkleRoot(events.map((event) => event.auditEvent.eventRoot).sort()) : hashJson({ kind: "canopyproof-empty-root-v1" }),
      actions: ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"],
      subjectTypes: canopyProofAgentSubjectTypes,
      safety: {
        aiNeverFinalAuthority: true,
        humanReviewRequiredForProof: true,
        noAutonomousCarbonCreditClaim: true,
      },
    };
  }
}

export function defaultCanopyProofAgents(): readonly CanopyProofAgentProfile[] {
  const specs: Array<Omit<CanopyProofAgentProfile, "registryHash" | "finalAuthority" | "status">> = [
    {
      id: "canopyproof-evidence-agent",
      name: "Evidence Agent",
      agentType: "evidence",
      layer: "Evidence",
      capabilities: ["offline sync", "media hashing", "GPS commitment", "community evidence routing"],
      allowedActions: ["ASSERT", "REASON", "DELEGATE", "CHALLENGE"],
      humanReviewRequired: true,
    },
    {
      id: "canopyproof-verification-agent",
      name: "Verification Agent",
      agentType: "verification",
      layer: "Verification",
      capabilities: ["satellite comparison", "duplicate detection", "fraud detection", "human review preparation"],
      allowedActions: ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"],
      humanReviewRequired: true,
    },
    {
      id: "canopyproof-esg-agent",
      name: "ESG Agent",
      agentType: "esg",
      layer: "Impact",
      capabilities: ["GRI mapping", "SDG mapping", "TNFD preparation", "report export lineage"],
      allowedActions: ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"],
      humanReviewRequired: true,
    },
    {
      id: "canopyproof-funding-agent",
      name: "Funding Agent",
      agentType: "funding",
      layer: "Governance",
      capabilities: ["grant transparency", "allocation lineage", "milestone evidence reconciliation"],
      allowedActions: ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"],
      humanReviewRequired: true,
    },
    {
      id: "canopyproof-risk-agent",
      name: "Risk Agent",
      agentType: "risk",
      layer: "Impact",
      capabilities: ["drought alerts", "wildfire alerts", "flood alerts", "ecosystem degradation watch"],
      allowedActions: ["ASSERT", "REASON", "DELEGATE", "CHALLENGE"],
      humanReviewRequired: true,
    },
    {
      id: "canopyproof-community-agent",
      name: "Community Agent",
      agentType: "community",
      layer: "Evidence",
      capabilities: ["community attestation", "local challenge routing", "field response coordination"],
      allowedActions: ["ASSERT", "REASON", "DELEGATE", "CHALLENGE"],
      humanReviewRequired: true,
    },
  ];
  return specs.map((spec) => ({
    ...spec,
    finalAuthority: false,
    status: "active",
    registryHash: hashJson({ kind: "canopyproof-agent-profile-v1", ...spec, finalAuthority: false, status: "active" }),
  }));
}

function assertSafeAgentText(values: readonly string[]) {
  const unsafePatterns = [
    /\bfinal\s+authority\b/i,
    /\bcertified\s+carbon\s+credit\b/i,
    /\bcarbon[-\s]?tax\s+offset\b/i,
    /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
    /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
  ];
  for (const value of values) {
    if (!value) continue;
    for (const pattern of unsafePatterns) {
      if (pattern.test(value) && !/\b(no|not|never|without)\b/i.test(value)) {
        throw new Error(`CanopyProof agent event contains unsupported public claim: ${value}`);
      }
    }
  }
}
