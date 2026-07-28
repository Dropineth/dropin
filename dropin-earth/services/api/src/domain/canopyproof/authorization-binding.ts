import { Prisma, type PrismaClient } from "@prisma/client";
import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofAuthenticatedPrincipal } from "./identity-authentication.js";
import { canopyProofIdentityParticipantTypes, canopyProofIdentityVerificationStatuses } from "./identity.js";
import { canopyProofOrganizationVerificationStatuses } from "./partner-collaboration.js";
import { canopyProofAccessRoles, type CanopyProofAccessRole } from "./security-policy.js";

export const canopyProofAuthorizationAssuranceLevels = [
  "participant",
  "organization_member",
  "verified_organization",
  "accredited_organization",
] as const;

export type CanopyProofAuthorizationAssurance = (typeof canopyProofAuthorizationAssuranceLevels)[number];

export const canopyProofAuthorizationErrorCodes = [
  "CANOPYPROOF_AUTHORIZATION_DENIED",
  "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE",
] as const;

export type CanopyProofAuthorizationErrorCode = (typeof canopyProofAuthorizationErrorCodes)[number];

type CanopyProofAuthorizationDenialReason =
  | "participant_not_found"
  | "participant_not_verified"
  | "role_not_granted"
  | "organization_required"
  | "organization_not_found"
  | "organization_inactive"
  | "membership_not_active"
  | "agent_type_mismatch"
  | "assurance_not_satisfied";

type CanopyProofAuthorizationUnavailableReason =
  | "configuration_invalid"
  | "registry_unavailable"
  | "registry_inconsistent";

export type CanopyProofAuthorizationRegistrySnapshot = {
  readonly participantId: string;
  readonly participantType: (typeof canopyProofIdentityParticipantTypes)[number];
  readonly participantRoles: readonly CanopyProofAccessRole[];
  readonly participantVerificationStatus: (typeof canopyProofIdentityVerificationStatuses)[number];
  readonly participantOrganizationId?: string;
  readonly organizationId?: string;
  readonly organizationVerificationStatus?: (typeof canopyProofOrganizationVerificationStatuses)[number];
  readonly organizationAccreditationStatus?: CanopyProofAccreditationStatus;
  readonly membershipId?: string;
  readonly membershipRole?: Exclude<CanopyProofAccessRole, "agent">;
  readonly membershipStatus?: CanopyProofMembershipStatus;
  readonly latestAccreditationId?: string;
  readonly latestAccreditationStatus?: CanopyProofAccreditationStatus;
};

export type CanopyProofAuthorizationBinding = {
  readonly actorId: string;
  readonly participantType: (typeof canopyProofIdentityParticipantTypes)[number];
  readonly role: CanopyProofAccessRole;
  readonly participantVerificationStatus: "verified";
  readonly organizationId?: string;
  readonly organizationVerificationStatus?: (typeof canopyProofOrganizationVerificationStatuses)[number];
  readonly organizationAccreditationStatus?: CanopyProofAccreditationStatus;
  readonly membershipId?: string;
  readonly evaluatedAt: string;
  readonly decisionHash: string;
  readonly source: "postgres" | "development_isolation";
};

export type CanopyProofAuthorizationBindingStatus = {
  readonly service: "canopyproof-authorization-binding";
  readonly mode: "enforced" | "development_isolation";
  readonly production: boolean;
  readonly configured: boolean;
  readonly databaseConfigured: boolean;
  readonly safety: {
    readonly durableParticipantRequiredInProduction: true;
    readonly exactRoleBindingRequired: true;
    readonly membershipRevocationChecked: true;
    readonly organizationRevocationChecked: true;
    readonly latestAccreditationChecked: true;
    readonly perRequestEvaluation: true;
    readonly developmentIsolationNotProductionAuthority: true;
    readonly tokenMaterialExcluded: true;
    readonly noAutomatedFinalAuthority: true;
  };
};

export interface CanopyProofAuthorizationRegistry {
  resolve(principal: CanopyProofAuthenticatedPrincipal): Promise<CanopyProofAuthorizationRegistrySnapshot | undefined>;
}

type CanopyProofAuthorizationPrismaClient = Pick<PrismaClient, "$queryRaw">;
type CanopyProofMembershipStatus = "active" | "suspended" | "revoked";
type CanopyProofAccreditationStatus = "pending" | "approved" | "suspended" | "revoked";

const institutionalRoles = new Set<CanopyProofAccessRole>(["owner", "admin", "verifier", "researcher", "observer"]);
const membershipRoles = ["owner", "admin", "verifier", "researcher", "community", "observer"] as const;
const membershipStatuses = ["active", "suspended", "revoked"] as const;
const accreditationStatuses = ["pending", "approved", "suspended", "revoked"] as const;

const registryRowSchema = z
  .object({
    participant_id: z.string().min(1).max(256),
    participant_type: z.enum(canopyProofIdentityParticipantTypes),
    participant_roles: z.array(z.enum(canopyProofAccessRoles)).min(1),
    participant_verification_status: z.enum(canopyProofIdentityVerificationStatuses),
    participant_organization_id: z.string().min(1).nullable(),
    bound_organization_id: z.string().min(1).nullable(),
    organization_verification_status: z.enum(canopyProofOrganizationVerificationStatuses).nullable(),
    organization_accreditation_status: z.enum(accreditationStatuses).nullable(),
    membership_id: z.string().min(1).nullable(),
    membership_role: z.enum(membershipRoles).nullable(),
    membership_status: z.enum(membershipStatuses).nullable(),
    latest_accreditation_id: z.string().min(1).nullable(),
    latest_accreditation_status: z.enum(accreditationStatuses).nullable(),
  })
  .strict();

export class CanopyProofAuthorizationError extends Error {
  constructor(
    readonly code: CanopyProofAuthorizationErrorCode,
    readonly reason: CanopyProofAuthorizationDenialReason | CanopyProofAuthorizationUnavailableReason,
    readonly httpStatus: 403 | 503,
  ) {
    super(
      code === "CANOPYPROOF_AUTHORIZATION_DENIED"
        ? "CANOPYPROOF_AUTHORIZATION_DENIED: durable authorization requirements were not satisfied."
        : "CANOPYPROOF_AUTHORIZATION_UNAVAILABLE: durable authorization could not be evaluated safely.",
    );
    this.name = "CanopyProofAuthorizationError";
  }
}

export class PrismaCanopyProofAuthorizationRegistry implements CanopyProofAuthorizationRegistry {
  constructor(private readonly prisma: CanopyProofAuthorizationPrismaClient) {}

  async resolve(principal: CanopyProofAuthenticatedPrincipal): Promise<CanopyProofAuthorizationRegistrySnapshot | undefined> {
    const rows = await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT *
      FROM identity.resolve_authorization_binding(
        ${principal.actorId}::text,
        ${principal.role}::text,
        ${principal.organizationId ?? null}::text
      )
    `);
    if (rows.length === 0) return undefined;
    if (rows.length !== 1) throw unavailable("registry_inconsistent");
    const row = registryRowSchema.safeParse(rows[0]);
    if (!row.success) throw unavailable("registry_inconsistent");
    return {
      participantId: row.data.participant_id,
      participantType: row.data.participant_type,
      participantRoles: row.data.participant_roles,
      participantVerificationStatus: row.data.participant_verification_status,
      ...(row.data.participant_organization_id ? { participantOrganizationId: row.data.participant_organization_id } : {}),
      ...(row.data.bound_organization_id ? { organizationId: row.data.bound_organization_id } : {}),
      ...(row.data.organization_verification_status
        ? { organizationVerificationStatus: row.data.organization_verification_status }
        : {}),
      ...(row.data.organization_accreditation_status
        ? { organizationAccreditationStatus: row.data.organization_accreditation_status }
        : {}),
      ...(row.data.membership_id ? { membershipId: row.data.membership_id } : {}),
      ...(row.data.membership_role ? { membershipRole: row.data.membership_role } : {}),
      ...(row.data.membership_status ? { membershipStatus: row.data.membership_status } : {}),
      ...(row.data.latest_accreditation_id ? { latestAccreditationId: row.data.latest_accreditation_id } : {}),
      ...(row.data.latest_accreditation_status ? { latestAccreditationStatus: row.data.latest_accreditation_status } : {}),
    };
  }
}

export async function bindCanopyProofAuthorizationPrincipal(
  principal: CanopyProofAuthenticatedPrincipal,
  environment: Readonly<Record<string, string | undefined>>,
  registry?: CanopyProofAuthorizationRegistry,
  evaluatedAt = new Date().toISOString(),
): Promise<CanopyProofAuthorizationBinding> {
  const production = isCanopyProofProduction(environment);
  if (principal.authenticationMethod === "development_headers") {
    if (production) throw unavailable("configuration_invalid");
    return developmentBinding(principal, evaluatedAt);
  }

  if (environment.DROPIN_REPOSITORY !== "prisma" || !environment.DATABASE_URL?.trim() || !registry) {
    throw unavailable("configuration_invalid");
  }

  let snapshot: CanopyProofAuthorizationRegistrySnapshot | undefined;
  try {
    snapshot = await registry.resolve(principal);
  } catch (error) {
    if (error instanceof CanopyProofAuthorizationError) throw error;
    throw unavailable("registry_unavailable");
  }
  if (!snapshot) throw denied("participant_not_found");
  assertRegistrySnapshot(snapshot, principal);

  const seed: Omit<CanopyProofAuthorizationBinding, "decisionHash"> = {
    actorId: principal.actorId,
    participantType: snapshot.participantType,
    role: principal.role,
    participantVerificationStatus: "verified" as const,
    ...(principal.organizationId
      ? {
          organizationId: principal.organizationId,
          organizationVerificationStatus: snapshot.organizationVerificationStatus!,
          organizationAccreditationStatus: snapshot.organizationAccreditationStatus!,
          membershipId: snapshot.membershipId!,
        }
      : {}),
    evaluatedAt,
    source: "postgres" as const,
  };
  return {
    ...seed,
    decisionHash: hashJson({ kind: "canopyproof-authorization-binding-v1", ...seed }),
  };
}

export function assertCanopyProofAuthorizationAssurance(
  binding: CanopyProofAuthorizationBinding,
  assurance: CanopyProofAuthorizationAssurance,
): void {
  if (assurance === "participant") return;
  if (!binding.organizationId || !binding.membershipId || !binding.organizationVerificationStatus) {
    throw denied("assurance_not_satisfied");
  }
  if (assurance === "organization_member") return;
  if (binding.organizationVerificationStatus !== "verified") {
    throw denied("assurance_not_satisfied");
  }
  if (assurance === "verified_organization") return;
  if (binding.organizationAccreditationStatus !== "approved") {
    throw denied("assurance_not_satisfied");
  }
}

export function requireCanopyProofAuthorizationBinding(
  binding: CanopyProofAuthorizationBinding | undefined,
  principal: CanopyProofAuthenticatedPrincipal,
): CanopyProofAuthorizationBinding {
  if (!binding || binding.actorId !== principal.actorId || binding.role !== principal.role) {
    throw unavailable("registry_inconsistent");
  }
  return binding;
}

export function canopyProofAuthorizationBindingStatus(
  environment: Readonly<Record<string, string | undefined>>,
): CanopyProofAuthorizationBindingStatus {
  const production = isCanopyProofProduction(environment);
  const enforced = production || environment.DROPIN_CANOPYPROOF_AUTH_MODE === "cloudflare_access_jwt";
  const databaseConfigured = Boolean(environment.DATABASE_URL?.trim()) && environment.DROPIN_REPOSITORY === "prisma";
  return {
    service: "canopyproof-authorization-binding",
    mode: enforced ? "enforced" : "development_isolation",
    production,
    configured: !enforced || databaseConfigured,
    databaseConfigured,
    safety: authorizationSafetyBoundary(),
  };
}

function assertRegistrySnapshot(
  snapshot: CanopyProofAuthorizationRegistrySnapshot,
  principal: CanopyProofAuthenticatedPrincipal,
): void {
  if (snapshot.participantId !== principal.actorId) throw unavailable("registry_inconsistent");
  if (snapshot.participantVerificationStatus !== "verified") throw denied("participant_not_verified");
  if (!snapshot.participantRoles.includes(principal.role)) throw denied("role_not_granted");
  if ((principal.role === "agent") !== (snapshot.participantType === "agent")) {
    throw denied("agent_type_mismatch");
  }

  if (!principal.organizationId) {
    if (institutionalRoles.has(principal.role)) throw denied("organization_required");
    if (
      snapshot.organizationId ||
      snapshot.membershipId ||
      snapshot.membershipRole ||
      snapshot.membershipStatus ||
      snapshot.organizationVerificationStatus ||
      snapshot.organizationAccreditationStatus ||
      snapshot.latestAccreditationId ||
      snapshot.latestAccreditationStatus
    ) {
      throw unavailable("registry_inconsistent");
    }
    return;
  }

  if (snapshot.organizationId !== principal.organizationId || !snapshot.organizationVerificationStatus) {
    throw denied("organization_not_found");
  }
  if (snapshot.organizationVerificationStatus === "suspended" || snapshot.organizationVerificationStatus === "revoked") {
    throw denied("organization_inactive");
  }
  if (
    !snapshot.membershipId ||
    snapshot.membershipRole !== principal.role ||
    snapshot.membershipStatus !== "active"
  ) {
    throw denied("membership_not_active");
  }
  assertAccreditationConsistency(snapshot);
}

function assertAccreditationConsistency(snapshot: CanopyProofAuthorizationRegistrySnapshot): void {
  if (!snapshot.organizationAccreditationStatus) throw unavailable("registry_inconsistent");
  if (!snapshot.latestAccreditationStatus) {
    if (snapshot.latestAccreditationId || snapshot.organizationAccreditationStatus !== "pending") {
      throw unavailable("registry_inconsistent");
    }
    return;
  }
  if (!snapshot.latestAccreditationId || snapshot.latestAccreditationStatus !== snapshot.organizationAccreditationStatus) {
    throw unavailable("registry_inconsistent");
  }
}

function developmentBinding(principal: CanopyProofAuthenticatedPrincipal, evaluatedAt: string): CanopyProofAuthorizationBinding {
  const participantType: "agent" | "human" = principal.role === "agent" ? "agent" : "human";
  const organizationId =
    principal.organizationId ??
    (institutionalRoles.has(principal.role)
      ? `cp_dev_organization_${hashJson({ actorId: principal.actorId, role: principal.role }).slice(0, 24)}`
      : undefined);
  const membershipId = organizationId
    ? `cp_dev_membership_${hashJson({ actorId: principal.actorId, organizationId, role: principal.role }).slice(0, 24)}`
    : undefined;
  const seed: Omit<CanopyProofAuthorizationBinding, "decisionHash"> = {
    actorId: principal.actorId,
    participantType,
    role: principal.role,
    participantVerificationStatus: "verified" as const,
    ...(organizationId
      ? {
          organizationId,
          organizationVerificationStatus: "verified" as const,
          organizationAccreditationStatus: "approved" as const,
          membershipId: membershipId!,
        }
      : {}),
    evaluatedAt,
    source: "development_isolation" as const,
  };
  return {
    ...seed,
    decisionHash: hashJson({ kind: "canopyproof-authorization-binding-v1", ...seed }),
  };
}

function isCanopyProofProduction(environment: Readonly<Record<string, string | undefined>>) {
  return environment.DROPIN_CANOPYPROOF_MODE === "production" || environment.NODE_ENV === "production";
}

function denied(reason: CanopyProofAuthorizationDenialReason) {
  return new CanopyProofAuthorizationError("CANOPYPROOF_AUTHORIZATION_DENIED", reason, 403);
}

function unavailable(reason: CanopyProofAuthorizationUnavailableReason) {
  return new CanopyProofAuthorizationError("CANOPYPROOF_AUTHORIZATION_UNAVAILABLE", reason, 503);
}

function authorizationSafetyBoundary() {
  return {
    durableParticipantRequiredInProduction: true as const,
    exactRoleBindingRequired: true as const,
    membershipRevocationChecked: true as const,
    organizationRevocationChecked: true as const,
    latestAccreditationChecked: true as const,
    perRequestEvaluation: true as const,
    developmentIsolationNotProductionAuthority: true as const,
    tokenMaterialExcluded: true as const,
    noAutomatedFinalAuthority: true as const,
  };
}
