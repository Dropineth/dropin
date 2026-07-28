import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofEvidenceTypes,
  type CanopyProofAuditEvent,
  type CanopyProofEvidenceType,
  type CanopyProofLocation,
} from "./proof-engine.js";
import type { CanopyProofProjectStatus } from "./project-registry.js";

export const canopyProofEvidenceContributorRoles = ["owner", "admin", "verifier", "researcher", "community"] as const;
export const canopyProofEvidenceRegistrationStatuses = ["validated", "challenged"] as const;
export const canopyProofEvidenceValidationIssues = ["gps_accuracy_too_weak", "project_region_mismatch"] as const;

export type CanopyProofEvidenceContributorRole = (typeof canopyProofEvidenceContributorRoles)[number];
export type CanopyProofEvidenceRegistrationStatus = (typeof canopyProofEvidenceRegistrationStatuses)[number];
export type CanopyProofEvidenceValidationIssue = (typeof canopyProofEvidenceValidationIssues)[number];

export type CanopyProofEvidenceProjectBoundary = {
  readonly id: string;
  readonly organizationId: string;
  readonly regionId: string;
  readonly status: CanopyProofProjectStatus;
  readonly projectRoot: string;
  readonly updatedAt: string;
};

export type CanopyProofEvidenceClaimBoundary = {
  readonly structuralValidationOnly: true;
  readonly pendingAiAndHumanReview: true;
  readonly notFinalVerification: true;
  readonly notCertificate: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
  readonly disclosure: string;
};

export type CanopyProofEvidenceRegistration = {
  readonly id: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly projectRootAtSubmission: string;
  readonly projectStatusAtSubmission: CanopyProofProjectStatus;
  readonly projectRegionIdAtSubmission: string;
  readonly projectAuthorityUpdatedAtAtSubmission: string;
  readonly evidenceType: CanopyProofEvidenceType;
  readonly location: CanopyProofLocation;
  readonly timestamp: string;
  readonly createdAt: string;
  readonly contributor: string;
  readonly contributorRole: CanopyProofEvidenceContributorRole;
  readonly media_hash: string;
  readonly gps_hash: string;
  readonly verification_status: CanopyProofEvidenceRegistrationStatus;
  readonly confidence_score: number;
  readonly reviewers: readonly [];
  readonly validationIssues: readonly CanopyProofEvidenceValidationIssue[];
  readonly offline_sync_id?: string;
  readonly device_fingerprint_hash?: string;
  readonly exif_hash?: string;
  readonly evidenceHash: string;
  readonly evidenceRoot: string;
  readonly audit_history: readonly [CanopyProofAuditEvent];
  readonly claimBoundary: CanopyProofEvidenceClaimBoundary;
};

export type CanopyProofEvidenceAuthoritySnapshot = {
  readonly registrations: readonly CanopyProofEvidenceRegistration[];
};

export type CanopyProofEvidenceRegistrationResult = {
  readonly valid: boolean;
  readonly issues: readonly CanopyProofEvidenceValidationIssue[];
  readonly evidence: CanopyProofEvidenceRegistration;
};

export type CanopyProofEvidenceRegistryStatus = {
  readonly service: "canopyproof-evidence-registry";
  readonly registrationCount: number;
  readonly validatedCount: number;
  readonly challengedCount: number;
  readonly evidenceRoot: string;
  readonly supportedEvidenceTypes: readonly CanopyProofEvidenceType[];
  readonly supportedContributorRoles: readonly CanopyProofEvidenceContributorRole[];
  readonly safety: {
    readonly registrationsImmutable: true;
    readonly projectRootBound: true;
    readonly structuralValidationNotFinal: true;
    readonly aiCannotApprove: true;
    readonly noFinancialOrCarbonCreditClaims: true;
  };
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const evidenceLocationSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracyMeters: z.number().finite().nonnegative().max(100_000).optional(),
    regionId: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const evidenceRegistrationSchema = z
  .object({
    id: z.string().trim().min(1).max(240).optional(),
    projectId: z.string().trim().min(1).max(240),
    evidenceType: z.enum(canopyProofEvidenceTypes),
    location: evidenceLocationSchema,
    timestamp: z.string().datetime(),
    media_hash: sha256Schema,
    gps_hash: sha256Schema,
    confidence_score: z.number().int().min(0).max(100).default(80),
    offline_sync_id: z.string().trim().min(1).max(240).optional(),
    device_fingerprint_hash: sha256Schema.optional(),
    exif_hash: sha256Schema.optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofEvidenceRegistryService {
  private readonly registrationsById = new Map<string, CanopyProofEvidenceRegistration>();
  private readonly evidenceIdByMediaHash = new Map<string, string>();

  static fromAuthoritySnapshot(snapshot: CanopyProofEvidenceAuthoritySnapshot) {
    const service = new CanopyProofEvidenceRegistryService();
    for (const registration of snapshot.registrations) {
      if (registration.audit_history.length !== 1) {
        throw new Error(`CanopyProof evidence registration audit history is not singular: ${registration.id}`);
      }
      const replayed = service.registerEvidence(
        {
          id: registration.id,
          projectId: registration.projectId,
          evidenceType: registration.evidenceType,
          location: registration.location,
          timestamp: registration.timestamp,
          media_hash: registration.media_hash,
          gps_hash: registration.gps_hash,
          confidence_score: registration.confidence_score,
          ...(registration.offline_sync_id ? { offline_sync_id: registration.offline_sync_id } : {}),
          ...(registration.device_fingerprint_hash
            ? { device_fingerprint_hash: registration.device_fingerprint_hash }
            : {}),
          ...(registration.exif_hash ? { exif_hash: registration.exif_hash } : {}),
          createdAt: registration.createdAt,
        },
        {
          id: registration.projectId,
          organizationId: registration.organizationId,
          regionId: registration.projectRegionIdAtSubmission,
          status: registration.projectStatusAtSubmission,
          projectRoot: registration.projectRootAtSubmission,
          updatedAt: registration.projectAuthorityUpdatedAtAtSubmission,
        },
        registration.contributor,
        registration.contributorRole,
      );
      if (hashJson(replayed.evidence) !== hashJson(registration)) {
        throw new Error(`CanopyProof evidence registration hash lineage is invalid: ${registration.id}`);
      }
    }
    return service;
  }

  registerEvidence(
    input: unknown,
    project: CanopyProofEvidenceProjectBoundary,
    contributorId: string,
    contributorRole: CanopyProofEvidenceContributorRole,
  ): CanopyProofEvidenceRegistrationResult {
    const parsed = evidenceRegistrationSchema.parse(input);
    if (!canopyProofEvidenceContributorRoles.includes(contributorRole)) {
      throw new Error(`CanopyProof evidence contributor role is invalid: ${contributorRole}`);
    }
    if (
      !project.id.trim() ||
      !project.organizationId.trim() ||
      !project.regionId.trim() ||
      !/^[a-f0-9]{64}$/.test(project.projectRoot) ||
      !Number.isFinite(Date.parse(project.updatedAt))
    ) {
      throw new Error("CanopyProof evidence project authority boundary is invalid.");
    }
    if (parsed.projectId !== project.id) {
      throw new Error("CanopyProof evidence project boundary does not match the requested project.");
    }
    if (project.status === "archived") {
      throw new Error("CanopyProof archived project cannot accept new evidence registration.");
    }
    assertSafeEvidenceText([
      parsed.id ?? "",
      parsed.projectId,
      parsed.location.regionId ?? "",
      parsed.offline_sync_id ?? "",
      contributorId,
      project.organizationId,
      project.regionId,
    ]);

    const createdAt = parsed.createdAt ?? parsed.timestamp;
    if (Date.parse(parsed.timestamp) > Date.parse(createdAt)) {
      throw new Error("CanopyProof evidence observation cannot occur after registration time.");
    }
    if (Date.parse(createdAt) < Date.parse(project.updatedAt)) {
      throw new Error("CanopyProof evidence registration cannot predate the bound project authority.");
    }
    const location = normalizeEvidenceLocation(parsed.location);
    const mediaHash = normalizeEvidenceHash(parsed.media_hash);
    const gpsHash = normalizeEvidenceHash(parsed.gps_hash);
    const deviceFingerprintHash = parsed.device_fingerprint_hash
      ? normalizeEvidenceHash(parsed.device_fingerprint_hash)
      : undefined;
    const exifHash = parsed.exif_hash ? normalizeEvidenceHash(parsed.exif_hash) : undefined;
    const validationIssues = deriveEvidenceValidationIssues(location, project.regionId);
    const verificationStatus: CanopyProofEvidenceRegistrationStatus =
      validationIssues.length === 0 ? "validated" : "challenged";
    const confidenceScore =
      verificationStatus === "validated" ? parsed.confidence_score : Math.min(parsed.confidence_score, 25);
    const candidateSeed = {
      projectId: project.id,
      organizationId: project.organizationId,
      projectRootAtSubmission: project.projectRoot,
      projectStatusAtSubmission: project.status,
      projectRegionIdAtSubmission: project.regionId,
      projectAuthorityUpdatedAtAtSubmission: project.updatedAt,
      evidenceType: parsed.evidenceType,
      location,
      timestamp: parsed.timestamp,
      createdAt,
      contributor: contributorId,
      contributorRole,
      media_hash: mediaHash,
      gps_hash: gpsHash,
      verification_status: verificationStatus,
      confidence_score: confidenceScore,
      reviewers: [] as const,
      validationIssues,
      offline_sync_id: parsed.offline_sync_id ?? null,
      device_fingerprint_hash: deviceFingerprintHash ?? null,
      exif_hash: exifHash ?? null,
    };
    const candidateHash = hashJson({ kind: "canopyproof-evidence-registration-candidate-v1", ...candidateSeed });
    const evidenceId = parsed.id ?? `cp_evidence_${candidateHash.slice(0, 24)}`;
    const claimBoundary = canopyProofEvidenceClaimBoundary();
    const evidenceHash = hashJson({
      kind: "canopyproof-evidence-registration-v1",
      id: evidenceId,
      ...candidateSeed,
      claimBoundary,
    });
    const evidenceRoot = hashJson({
      kind: "canopyproof-evidence-root-v1",
      projectRoot: project.projectRoot,
      evidenceHash,
      mediaHash,
      gpsHash,
    });
    const existing = this.registrationsById.get(evidenceId);
    if (existing) {
      if (existing.evidenceHash === evidenceHash && existing.evidenceRoot === evidenceRoot) {
        return evidenceRegistrationResult(existing);
      }
      throw new Error(`CanopyProof evidence already exists with conflicting payload: ${evidenceId}`);
    }
    const duplicateEvidenceId = this.evidenceIdByMediaHash.get(mediaHash);
    if (duplicateEvidenceId) {
      throw new Error(`CanopyProof evidence media hash is already registered: ${duplicateEvidenceId}`);
    }
    const rationale = evidenceRegistrationRationale(verificationStatus);
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: verificationStatus === "challenged" ? "CHALLENGE" : "ASSERT",
      actor: contributorId,
      entityType: "evidence",
      entityId: evidenceId,
      payload: {
        id: evidenceId,
        ...candidateSeed,
        evidenceHash,
        evidenceRoot,
        claimBoundary,
      },
      createdAt,
      rationale,
    });
    const auditEvent = auditHistory[0];
    if (!auditEvent) throw new Error("CanopyProof evidence registration failed to create an audit event.");
    const registration: CanopyProofEvidenceRegistration = {
      id: evidenceId,
      projectId: project.id,
      organizationId: project.organizationId,
      projectRootAtSubmission: project.projectRoot,
      projectStatusAtSubmission: project.status,
      projectRegionIdAtSubmission: project.regionId,
      projectAuthorityUpdatedAtAtSubmission: project.updatedAt,
      evidenceType: parsed.evidenceType,
      location,
      timestamp: parsed.timestamp,
      createdAt,
      contributor: contributorId,
      contributorRole,
      media_hash: mediaHash,
      gps_hash: gpsHash,
      verification_status: verificationStatus,
      confidence_score: confidenceScore,
      reviewers: [],
      validationIssues,
      ...(parsed.offline_sync_id ? { offline_sync_id: parsed.offline_sync_id } : {}),
      ...(deviceFingerprintHash ? { device_fingerprint_hash: deviceFingerprintHash } : {}),
      ...(exifHash ? { exif_hash: exifHash } : {}),
      evidenceHash,
      evidenceRoot,
      audit_history: [auditEvent],
      claimBoundary,
    };
    this.registrationsById.set(registration.id, registration);
    this.evidenceIdByMediaHash.set(registration.media_hash, registration.id);
    return evidenceRegistrationResult(registration);
  }

  listEvidence(
    filter: Readonly<{
      projectId?: string;
      evidenceType?: CanopyProofEvidenceType;
      verificationStatus?: CanopyProofEvidenceRegistrationStatus;
    }> = {},
  ) {
    return [...this.registrationsById.values()]
      .filter((registration) => !filter.projectId || registration.projectId === filter.projectId)
      .filter((registration) => !filter.evidenceType || registration.evidenceType === filter.evidenceType)
      .filter(
        (registration) =>
          !filter.verificationStatus || registration.verification_status === filter.verificationStatus,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  getEvidence(evidenceId: string) {
    const registration = this.registrationsById.get(evidenceId);
    if (!registration) throw new Error(`CanopyProof evidence not found: ${evidenceId}`);
    return registration;
  }

  getStatus(): CanopyProofEvidenceRegistryStatus {
    const registrations = this.listEvidence();
    return {
      service: "canopyproof-evidence-registry",
      registrationCount: registrations.length,
      validatedCount: registrations.filter((item) => item.verification_status === "validated").length,
      challengedCount: registrations.filter((item) => item.verification_status === "challenged").length,
      evidenceRoot:
        registrations.length > 0
          ? merkleRoot(registrations.map((item) => item.evidenceRoot).sort())
          : hashJson({ kind: "canopyproof-empty-evidence-registration-root-v1" }),
      supportedEvidenceTypes: canopyProofEvidenceTypes,
      supportedContributorRoles: canopyProofEvidenceContributorRoles,
      safety: {
        registrationsImmutable: true,
        projectRootBound: true,
        structuralValidationNotFinal: true,
        aiCannotApprove: true,
        noFinancialOrCarbonCreditClaims: true,
      },
    };
  }
}

export function canopyProofEvidenceClaimBoundary(): CanopyProofEvidenceClaimBoundary {
  return {
    structuralValidationOnly: true,
    pendingAiAndHumanReview: true,
    notFinalVerification: true,
    notCertificate: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
    disclosure:
      "This evidence registration passed or failed structural ingestion checks only. It is pending AI assistance and accountable human review; it is not final verification, a certificate, certified carbon credit, carbon-tax offset, financial asset, guaranteed yield, mainnet-fund movement, or automatic CANOPY distribution.",
  };
}

function evidenceRegistrationResult(evidence: CanopyProofEvidenceRegistration): CanopyProofEvidenceRegistrationResult {
  return {
    valid: evidence.verification_status === "validated",
    issues: evidence.validationIssues,
    evidence,
  };
}

function evidenceRegistrationRationale(status: CanopyProofEvidenceRegistrationStatus) {
  return status === "validated"
    ? "Evidence envelope accepted as structurally valid and remains pending AI and accountable human review."
    : "Evidence envelope retained in challenged state after deterministic structural validation.";
}

function deriveEvidenceValidationIssues(
  location: CanopyProofLocation,
  projectRegionId: string,
): readonly CanopyProofEvidenceValidationIssue[] {
  const issues: CanopyProofEvidenceValidationIssue[] = [];
  if (location.accuracyMeters !== undefined && location.accuracyMeters > 100) {
    issues.push("gps_accuracy_too_weak");
  }
  if (location.regionId && location.regionId !== projectRegionId) {
    issues.push("project_region_mismatch");
  }
  return issues.sort();
}

function normalizeEvidenceLocation(location: z.infer<typeof evidenceLocationSchema>): CanopyProofLocation {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    ...(location.accuracyMeters !== undefined ? { accuracyMeters: location.accuracyMeters } : {}),
    ...(location.regionId ? { regionId: location.regionId } : {}),
  };
}

function normalizeEvidenceHash(value: string) {
  return value.replace(/^sha256:/i, "").toLowerCase();
}

function assertSafeEvidenceText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) {
    throw new Error(`CanopyProof evidence registration contains unsupported public claim or secret material: ${unsafe}`);
  }
}
