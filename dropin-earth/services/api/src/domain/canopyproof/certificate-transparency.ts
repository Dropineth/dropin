import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";
import type { CanopyProofCertificateArtifact } from "./proof-service.js";

export const canopyProofCertificateTransparencyStatuses = ["active", "challenged", "revoked"] as const;
export const canopyProofCertificateVerificationIssueCodes = [
  "missing_certificate_hash",
  "invalid_certificate_hash",
  "entry_hash_mismatch",
  "claim_boundary_violation",
  "record_hash_mismatch",
  "evidence_root_mismatch",
  "monitoring_root_mismatch",
  "governance_root_mismatch",
  "challenge_root_mismatch",
] as const;

export type CanopyProofCertificateTransparencyStatus = (typeof canopyProofCertificateTransparencyStatuses)[number];
export type CanopyProofCertificateVerificationIssueCode = (typeof canopyProofCertificateVerificationIssueCodes)[number];

export type CanopyProofCertificateTransparencyEntry = {
  readonly id: string;
  readonly certificateId: string;
  readonly certificateVersion: CanopyProofCertificateArtifact["certificateVersion"];
  readonly recordId: string;
  readonly projectId: string;
  readonly certificateHash: string;
  readonly sourceRecordHash: string;
  readonly evidenceRoot: string;
  readonly monitoringEventRoot: string;
  readonly governanceApprovalRoot: string;
  readonly challengeRoot: string;
  readonly claimBoundaryRoot: string;
  readonly status: CanopyProofCertificateTransparencyStatus;
  readonly issuedAt: string;
  readonly publishedAt: string;
  readonly publishedBy: string;
  readonly entryHash: string;
  readonly safety: {
    readonly transparencyOnly: true;
    readonly publicVerification: true;
    readonly noCarbonCreditAuthority: true;
    readonly noFinancialOrTaxAuthority: true;
    readonly noGuaranteedYield: true;
    readonly noAutomaticTokenDistribution: true;
    readonly rawEvidenceExcluded: true;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofCertificateVerificationResult = {
  readonly valid: boolean;
  readonly certificateId: string;
  readonly recordId: string;
  readonly certificateHash: string;
  readonly recomputedCertificateHash: string;
  readonly expectedEntryHash?: string;
  readonly recomputedEntryHash: string;
  readonly issues: readonly CanopyProofCertificateVerificationIssueCode[];
  readonly verifiedAt: string;
  readonly verifier: string;
  readonly verificationRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofCertificateTransparencyStatusSummary = {
  readonly service: "canopyproof-certificate-transparency";
  readonly entryCount: number;
  readonly activeCount: number;
  readonly challengedCount: number;
  readonly revokedCount: number;
  readonly safety: {
    readonly certificateArtifactsOnly: true;
    readonly noRawEvidencePayloads: true;
    readonly publicReplayVerification: true;
    readonly notCarbonCreditRegistry: true;
  };
  readonly transparencyRoot: string;
};

const publishCertificateTransparencySchema = z
  .object({
    id: z.string().min(1).optional(),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();

const verifyCertificateArtifactSchema = z
  .object({
    artifact: z.unknown(),
    expectedEntryHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    expectedRecordHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    expectedEvidenceRoot: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    expectedMonitoringEventRoot: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    expectedGovernanceApprovalRoot: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    expectedChallengeRoot: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    verifiedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofCertificateTransparencyService {
  private readonly entriesById = new Map<string, CanopyProofCertificateTransparencyEntry>();
  private readonly entryIdsByCertificateId = new Map<string, string>();

  publishCertificateArtifact(input: unknown, artifact: CanopyProofCertificateArtifact, actorId: string): CanopyProofCertificateTransparencyEntry {
    const parsed = publishCertificateTransparencySchema.parse(input);
    const publishedAt = parsed.publishedAt ?? new Date(0).toISOString();
    const certificateHash = recomputeCertificateHash(artifact);
    if (certificateHash !== artifact.certificateHash) {
      throw new Error("CanopyProof certificate artifact hash does not match its canonical payload.");
    }
    assertCertificateClaimBoundary(artifact);
    const seed = buildCertificateTransparencySeed(artifact, publishedAt, actorId);
    const entryHash = certificateReplayEntryHash(artifact);
    const id = parsed.id ?? `cp_cert_transparency_${entryHash.slice(0, 24)}`;
    const existingId = this.entryIdsByCertificateId.get(artifact.certificateId);
    if (existingId && existingId !== id) {
      throw new Error(`CanopyProof certificate artifact is already published: ${artifact.certificateId}`);
    }
    if (this.entriesById.has(id)) {
      throw new Error(`CanopyProof certificate transparency entry already exists: ${id}`);
    }
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: seed.status === "active" ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "certificate_transparency_entry",
      entityId: id,
      payload: {
        ...seed,
        entryHash,
      },
      createdAt: publishedAt,
      rationale: "CanopyProof certificate artifact published to transparency ledger for institutional replay verification.",
    })[0];
    if (!auditEvent) {
      throw new Error("CanopyProof certificate transparency entry requires an audit event.");
    }
    const entry: CanopyProofCertificateTransparencyEntry = {
      id,
      ...seed,
      entryHash,
      auditEvent,
    };
    this.entriesById.set(id, entry);
    this.entryIdsByCertificateId.set(entry.certificateId, entry.id);
    return entry;
  }

  verifyCertificateArtifact(input: unknown, actorId: string): CanopyProofCertificateVerificationResult {
    const parsed = verifyCertificateArtifactSchema.parse(input);
    const artifact = parseCertificateArtifact(parsed.artifact);
    const verifiedAt = parsed.verifiedAt ?? new Date(0).toISOString();
    const issues: CanopyProofCertificateVerificationIssueCode[] = [];
    const recomputedCertificateHash = recomputeCertificateHash(artifact);
    if (!artifact.certificateHash) {
      issues.push("missing_certificate_hash");
    }
    if (artifact.certificateHash !== recomputedCertificateHash) {
      issues.push("invalid_certificate_hash");
    }
    if (parsed.expectedRecordHash && parsed.expectedRecordHash.toLowerCase() !== artifact.sourceRecordHash) {
      issues.push("record_hash_mismatch");
    }
    if (parsed.expectedEvidenceRoot && parsed.expectedEvidenceRoot.toLowerCase() !== artifact.evidenceRoot) {
      issues.push("evidence_root_mismatch");
    }
    if (parsed.expectedMonitoringEventRoot && parsed.expectedMonitoringEventRoot.toLowerCase() !== artifact.monitoringEventRoot) {
      issues.push("monitoring_root_mismatch");
    }
    const governanceApprovalRoot = certificateGovernanceApprovalRoot(artifact);
    if (parsed.expectedGovernanceApprovalRoot && parsed.expectedGovernanceApprovalRoot.toLowerCase() !== governanceApprovalRoot) {
      issues.push("governance_root_mismatch");
    }
    const challengeRoot = certificateChallengeRoot(artifact);
    if (parsed.expectedChallengeRoot && parsed.expectedChallengeRoot.toLowerCase() !== challengeRoot) {
      issues.push("challenge_root_mismatch");
    }
    if (!certificateClaimBoundaryIsSafe(artifact)) {
      issues.push("claim_boundary_violation");
    }
    const recomputedEntryHash = certificateReplayEntryHash(artifact);
    if (parsed.expectedEntryHash && parsed.expectedEntryHash.toLowerCase() !== recomputedEntryHash) {
      issues.push("entry_hash_mismatch");
    }
    const verificationRoot = hashJson({
      kind: "canopyproof-certificate-verification-result-v1",
      certificateId: artifact.certificateId,
      recordId: artifact.recordId,
      recomputedCertificateHash,
      recomputedEntryHash,
      issues: [...issues].sort(),
      verifiedAt,
      verifier: actorId,
    });
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: issues.length === 0 ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "certificate_verification",
      entityId: `cp_cert_verification_${verificationRoot.slice(0, 24)}`,
      payload: {
        certificateId: artifact.certificateId,
        recordId: artifact.recordId,
        certificateHash: artifact.certificateHash,
        recomputedCertificateHash,
        recomputedEntryHash,
        issues,
        verificationRoot,
      },
      createdAt: verifiedAt,
      rationale:
        issues.length === 0
          ? "CanopyProof certificate artifact replay verification passed."
          : "CanopyProof certificate artifact replay verification found mismatches or unsafe claim boundaries.",
    })[0];
    if (!auditEvent) {
      throw new Error("CanopyProof certificate verification requires an audit event.");
    }
    return {
      valid: issues.length === 0,
      certificateId: artifact.certificateId,
      recordId: artifact.recordId,
      certificateHash: artifact.certificateHash,
      recomputedCertificateHash,
      ...(parsed.expectedEntryHash ? { expectedEntryHash: parsed.expectedEntryHash.toLowerCase() } : {}),
      recomputedEntryHash,
      issues,
      verifiedAt,
      verifier: actorId,
      verificationRoot,
      auditEvent,
    };
  }

  listEntries(
    filter: Readonly<{
      recordId?: string;
      projectId?: string;
      status?: CanopyProofCertificateTransparencyStatus;
    }> = {},
  ) {
    return [...this.entriesById.values()]
      .filter((entry) => !filter.recordId || entry.recordId === filter.recordId)
      .filter((entry) => !filter.projectId || entry.projectId === filter.projectId)
      .filter((entry) => !filter.status || entry.status === filter.status)
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || left.id.localeCompare(right.id));
  }

  getEntry(entryId: string) {
    const entry = this.entriesById.get(entryId);
    if (!entry) {
      throw new Error(`CanopyProof certificate transparency entry not found: ${entryId}`);
    }
    return entry;
  }

  getStatus(): CanopyProofCertificateTransparencyStatusSummary {
    const entries = this.listEntries();
    return {
      service: "canopyproof-certificate-transparency",
      entryCount: entries.length,
      activeCount: entries.filter((entry) => entry.status === "active").length,
      challengedCount: entries.filter((entry) => entry.status === "challenged").length,
      revokedCount: entries.filter((entry) => entry.status === "revoked").length,
      safety: {
        certificateArtifactsOnly: true,
        noRawEvidencePayloads: true,
        publicReplayVerification: true,
        notCarbonCreditRegistry: true,
      },
      transparencyRoot:
        entries.length > 0
          ? merkleRoot(entries.map((entry) => entry.entryHash).sort())
          : hashJson({ kind: "canopyproof-empty-certificate-transparency-root-v1" }),
    };
  }
}

function buildCertificateTransparencySeed(artifact: CanopyProofCertificateArtifact, publishedAt: string, actorId: string) {
  return {
    certificateId: artifact.certificateId,
    certificateVersion: artifact.certificateVersion,
    recordId: artifact.recordId,
    projectId: artifact.project.id,
    certificateHash: artifact.certificateHash,
    sourceRecordHash: artifact.sourceRecordHash,
    evidenceRoot: artifact.evidenceRoot,
    monitoringEventRoot: artifact.monitoringEventRoot,
    governanceApprovalRoot: certificateGovernanceApprovalRoot(artifact),
    challengeRoot: certificateChallengeRoot(artifact),
    claimBoundaryRoot: hashJson(artifact.claimBoundary),
    status: certificateTransparencyStatus(artifact),
    issuedAt: artifact.issuedAt,
    publishedAt,
    publishedBy: actorId,
    safety: certificateTransparencySafety(),
  };
}

function certificateReplayEntryHash(artifact: CanopyProofCertificateArtifact) {
  return hashJson({
    kind: "canopyproof-certificate-transparency-entry-replay-v1",
    certificateId: artifact.certificateId,
    recordId: artifact.recordId,
    certificateHash: recomputeCertificateHash(artifact),
    sourceRecordHash: artifact.sourceRecordHash,
    evidenceRoot: artifact.evidenceRoot,
    monitoringEventRoot: artifact.monitoringEventRoot,
    governanceApprovalRoot: certificateGovernanceApprovalRoot(artifact),
    challengeRoot: certificateChallengeRoot(artifact),
    claimBoundaryRoot: hashJson(artifact.claimBoundary),
  });
}

function certificateTransparencyStatus(artifact: CanopyProofCertificateArtifact): CanopyProofCertificateTransparencyStatus {
  if (artifact.status === "revoked") return "revoked";
  if (artifact.status === "challenged" || artifact.publicChallenges.some((challenge) => challenge.status === "open" || challenge.status === "accepted")) {
    return "challenged";
  }
  return "active";
}

function certificateGovernanceApprovalRoot(artifact: CanopyProofCertificateArtifact) {
  return artifact.governanceApprovals.length > 0
    ? merkleRoot(artifact.governanceApprovals.map((approval) => approval.approvalHash).sort())
    : hashJson({ kind: "canopyproof-empty-certificate-governance-approval-root-v1", certificateId: artifact.certificateId });
}

function certificateChallengeRoot(artifact: CanopyProofCertificateArtifact) {
  return artifact.publicChallenges.length > 0
    ? merkleRoot(artifact.publicChallenges.map((challenge) => hashJson(challenge)).sort())
    : hashJson({ kind: "canopyproof-empty-certificate-challenge-root-v1", certificateId: artifact.certificateId });
}

function recomputeCertificateHash(artifact: CanopyProofCertificateArtifact) {
  const { certificateHash, ...artifactBase } = artifact;
  void certificateHash;
  return hashJson(artifactBase);
}

function assertCertificateClaimBoundary(artifact: CanopyProofCertificateArtifact) {
  if (!certificateClaimBoundaryIsSafe(artifact)) {
    throw new Error("CanopyProof certificate artifact violates the non-credit/non-financial claim boundary.");
  }
  const unsafeClaims = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]?tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+(?:\$?canopy|canopy)\s+distribution/i,
    /mainnet\s+funds/i,
  ] as const;
  for (const value of [artifact.disclosure, artifact.claimBoundary.disclosure]) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited|excluded)\b/i.test(value)) {
        throw new Error(`CanopyProof certificate transparency entry contains unsupported public claim: ${value}`);
      }
    }
  }
}

function certificateClaimBoundaryIsSafe(artifact: CanopyProofCertificateArtifact) {
  return (
    artifact.claimBoundary.notCarbonCredit === true &&
    artifact.claimBoundary.notFinancialAsset === true &&
    artifact.claimBoundary.notTaxOffset === true &&
    artifact.claimBoundary.notGuaranteedYield === true &&
    artifact.claimBoundary.notAutomaticCanopyDistribution === true
  );
}

function certificateTransparencySafety(): CanopyProofCertificateTransparencyEntry["safety"] {
  return {
    transparencyOnly: true,
    publicVerification: true,
    noCarbonCreditAuthority: true,
    noFinancialOrTaxAuthority: true,
    noGuaranteedYield: true,
    noAutomaticTokenDistribution: true,
    rawEvidenceExcluded: true,
  };
}

function parseCertificateArtifact(input: unknown): CanopyProofCertificateArtifact {
  if (typeof input !== "object" || input === null) {
    throw new Error("CanopyProof certificate verification requires an artifact object.");
  }
  const artifact = input as CanopyProofCertificateArtifact;
  const requiredStrings: readonly [keyof CanopyProofCertificateArtifact, string][] = [
    ["certificateId", "certificateId"],
    ["certificateVersion", "certificateVersion"],
    ["recordId", "recordId"],
    ["recordType", "recordType"],
    ["evidenceRoot", "evidenceRoot"],
    ["monitoringEventRoot", "monitoringEventRoot"],
    ["status", "status"],
    ["issuedAt", "issuedAt"],
    ["sourceRecordHash", "sourceRecordHash"],
    ["disclosure", "disclosure"],
    ["certificateHash", "certificateHash"],
  ];
  for (const [key, label] of requiredStrings) {
    if (typeof artifact[key] !== "string" || !(artifact[key] as string).trim()) {
      throw new Error(`CanopyProof certificate artifact ${label} is required.`);
    }
  }
  if (artifact.certificateVersion !== "canopyproof_certificate_artifact_v1") {
    throw new Error("CanopyProof certificate artifact version is unsupported.");
  }
  if (typeof artifact.project !== "object" || artifact.project === null || typeof artifact.project.id !== "string") {
    throw new Error("CanopyProof certificate artifact project is required.");
  }
  if (!Array.isArray(artifact.evidenceIds) || !Array.isArray(artifact.governanceApprovals) || !Array.isArray(artifact.publicChallenges)) {
    throw new Error("CanopyProof certificate artifact arrays are required.");
  }
  if (typeof artifact.claimBoundary !== "object" || artifact.claimBoundary === null) {
    throw new Error("CanopyProof certificate artifact claim boundary is required.");
  }
  return artifact;
}
