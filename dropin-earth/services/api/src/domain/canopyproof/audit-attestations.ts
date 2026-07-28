import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofAuditAttestationScopes = ["evidence", "proof_record", "organization", "funding", "governance", "reporting", "system"] as const;
export const canopyProofAuditAttestationMethods = [
  "audit_chain_replay",
  "evidence_sample_review",
  "governance_controls_review",
  "funding_trace_review",
  "reporting_lineage_review",
] as const;
export const canopyProofAuditAttestationStandards = ["ISAE_3000", "ISO_14064_3", "UN_SDG_EVIDENCE", "GRI_2", "TNFD_BETA", "CUSTOM"] as const;
export const canopyProofAuditAttestationDecisions = ["attest", "qualified", "reject"] as const;
export const canopyProofAuditFindingSeverities = ["low", "medium", "high", "critical"] as const;

export type CanopyProofAuditAttestationScope = (typeof canopyProofAuditAttestationScopes)[number];
export type CanopyProofAuditAttestationMethod = (typeof canopyProofAuditAttestationMethods)[number];
export type CanopyProofAuditAttestationStandard = (typeof canopyProofAuditAttestationStandards)[number];
export type CanopyProofAuditAttestationDecision = (typeof canopyProofAuditAttestationDecisions)[number];
export type CanopyProofAuditFindingSeverity = (typeof canopyProofAuditFindingSeverities)[number];

export type CanopyProofAuditFinding = {
  readonly id: string;
  readonly severity: CanopyProofAuditFindingSeverity;
  readonly statement: string;
  readonly evidenceRoot?: string;
};

export type CanopyProofInstitutionalAuditAttestation = {
  readonly id: string;
  readonly scope: CanopyProofAuditAttestationScope;
  readonly subjectId: string;
  readonly auditorOrganizationId: string;
  readonly auditorName: string;
  readonly methods: readonly CanopyProofAuditAttestationMethod[];
  readonly standards: readonly CanopyProofAuditAttestationStandard[];
  readonly sourceEventRoots: readonly string[];
  readonly sourceEventRoot: string;
  readonly auditVerificationRoot: string;
  readonly findingRoot: string;
  readonly findings: readonly CanopyProofAuditFinding[];
  readonly decision: CanopyProofAuditAttestationDecision;
  readonly independenceStatement: string;
  readonly limitations: readonly string[];
  readonly publicSummary: string;
  readonly issuedAt: string;
  readonly attestationHash: string;
  readonly claimBoundary: {
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
    readonly notAutomaticCanopyDistribution: true;
    readonly disclosure: string;
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofAuditAttestationStatus = {
  readonly service: "canopyproof-audit-attestations";
  readonly attestationCount: number;
  readonly rejectedCount: number;
  readonly qualifiedCount: number;
  readonly scopes: readonly CanopyProofAuditAttestationScope[];
  readonly methods: readonly CanopyProofAuditAttestationMethod[];
  readonly standards: readonly CanopyProofAuditAttestationStandard[];
  readonly safety: {
    readonly independentAuditorRequired: true;
    readonly sourceEventRootsRequired: true;
    readonly qualifiedAndRejectedFindingsPreserved: true;
    readonly noFinancialOrCarbonCreditAuthority: true;
    readonly appendOnlyAuditEvents: true;
  };
  readonly attestationRoot: string;
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const auditFindingSchema = z
  .object({
    id: z.string().min(1).optional(),
    severity: z.enum(canopyProofAuditFindingSeverities),
    statement: z.string().min(12).max(2_000),
    evidenceRoot: sha256Schema.optional(),
  })
  .strict();

const auditAttestationSchema = z
  .object({
    id: z.string().min(1).optional(),
    scope: z.enum(canopyProofAuditAttestationScopes),
    subjectId: z.string().min(1),
    auditorOrganizationId: z.string().min(1),
    auditorName: z.string().min(2),
    methods: z.array(z.enum(canopyProofAuditAttestationMethods)).min(1),
    standards: z.array(z.enum(canopyProofAuditAttestationStandards)).min(1),
    sourceEventRoots: z.array(sha256Schema).min(1),
    auditVerificationRoot: sha256Schema,
    findings: z.array(auditFindingSchema).default([]),
    decision: z.enum(canopyProofAuditAttestationDecisions),
    independenceStatement: z.string().min(24).max(2_000),
    limitations: z.array(z.string().min(8).max(1_000)).min(1),
    publicSummary: z.string().min(24).max(2_000),
    issuedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofAuditAttestationService {
  private readonly attestationsById = new Map<string, CanopyProofInstitutionalAuditAttestation>();

  createAttestation(input: unknown, actorId: string) {
    const parsed = auditAttestationSchema.parse(input);
    const issuedAt = parsed.issuedAt ?? new Date(0).toISOString();
    const methods = [...new Set(parsed.methods)].sort();
    const standards = [...new Set(parsed.standards)].sort();
    const sourceEventRoots = [...new Set(parsed.sourceEventRoots.map((root) => normalizeSha256(root)))].sort();
    const findings = normalizeFindings(parsed.findings);
    assertSafeAuditAttestationText([
      parsed.subjectId,
      parsed.auditorOrganizationId,
      parsed.auditorName,
      parsed.independenceStatement,
      parsed.publicSummary,
      ...parsed.limitations,
      ...findings.map((finding) => finding.statement),
    ]);
    assertDecisionMatchesFindings(parsed.decision, findings);

    const sourceEventRoot = merkleRoot(sourceEventRoots);
    const findingRoot = findings.length > 0 ? merkleRoot(findings.map((finding) => hashJson(finding)).sort()) : hashJson({ kind: "no-audit-findings" });
    const attestationSeed = {
      scope: parsed.scope,
      subjectId: parsed.subjectId,
      auditorOrganizationId: parsed.auditorOrganizationId,
      auditorName: parsed.auditorName,
      methods,
      standards,
      sourceEventRoots,
      sourceEventRoot,
      auditVerificationRoot: normalizeSha256(parsed.auditVerificationRoot),
      findingRoot,
      findings,
      decision: parsed.decision,
      independenceStatement: parsed.independenceStatement,
      limitations: [...parsed.limitations].sort(),
      publicSummary: parsed.publicSummary,
      issuedAt,
      claimBoundary: institutionalAuditClaimBoundary(),
    };
    const attestationHash = hashJson({ kind: "canopyproof-institutional-audit-attestation-v1", ...attestationSeed });
    const id = parsed.id ?? `cp_audit_attestation_${attestationHash.slice(0, 24)}`;
    if (this.attestationsById.has(id)) {
      throw new Error(`CanopyProof audit attestation already exists: ${id}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(this.listAttestations().map((attestation) => attestation.auditEvent), {
      action: parsed.decision === "attest" ? "ASSERT" : "CHALLENGE",
      actor: actorId,
      entityType: "audit_attestation",
      entityId: id,
      payload: {
        ...attestationSeed,
        attestationHash,
      },
      createdAt: issuedAt,
      rationale:
        parsed.decision === "attest"
          ? "Institutional auditor attested this scope from replayed audit roots, methodology, standards, and independence statement."
          : "Institutional auditor preserved a qualified or rejected finding without promoting it into a clean proof state.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof audit attestation failed to append audit event.");
    }
    const attestation: CanopyProofInstitutionalAuditAttestation = {
      id,
      ...attestationSeed,
      attestationHash,
      auditEvent,
    };
    this.attestationsById.set(attestation.id, attestation);
    return attestation;
  }

  listAttestations(
    filter: Readonly<{ scope?: CanopyProofAuditAttestationScope; subjectId?: string; decision?: CanopyProofAuditAttestationDecision }> = {},
  ) {
    return [...this.attestationsById.values()]
      .filter((attestation) => !filter.scope || attestation.scope === filter.scope)
      .filter((attestation) => !filter.subjectId || attestation.subjectId === filter.subjectId)
      .filter((attestation) => !filter.decision || attestation.decision === filter.decision)
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt) || left.id.localeCompare(right.id));
  }

  getAttestation(attestationId: string) {
    const attestation = this.attestationsById.get(attestationId);
    if (!attestation) {
      throw new Error(`CanopyProof audit attestation not found: ${attestationId}`);
    }
    return attestation;
  }

  getStatus(): CanopyProofAuditAttestationStatus {
    const attestations = this.listAttestations();
    return {
      service: "canopyproof-audit-attestations",
      attestationCount: attestations.length,
      rejectedCount: attestations.filter((attestation) => attestation.decision === "reject").length,
      qualifiedCount: attestations.filter((attestation) => attestation.decision === "qualified").length,
      scopes: canopyProofAuditAttestationScopes,
      methods: canopyProofAuditAttestationMethods,
      standards: canopyProofAuditAttestationStandards,
      safety: {
        independentAuditorRequired: true,
        sourceEventRootsRequired: true,
        qualifiedAndRejectedFindingsPreserved: true,
        noFinancialOrCarbonCreditAuthority: true,
        appendOnlyAuditEvents: true,
      },
      attestationRoot:
        attestations.length > 0
          ? merkleRoot(attestations.map((attestation) => attestation.attestationHash).sort())
          : hashJson({ kind: "canopyproof-empty-audit-attestation-root-v1" }),
    };
  }
}

export function institutionalAuditClaimBoundary(): CanopyProofInstitutionalAuditAttestation["claimBoundary"] {
  return {
    notCarbonCredit: true,
    notFinancialAsset: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
    notAutomaticCanopyDistribution: true,
    disclosure:
      "This is an institutional audit attestation over CanopyProof evidence, governance, or reporting lineage. It is not a certified carbon credit, financial asset, carbon-tax offset, guaranteed yield instrument, or automatic CANOPY distribution claim.",
  };
}

function normalizeSha256(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function normalizeFindings(findings: readonly z.infer<typeof auditFindingSchema>[]): readonly CanopyProofAuditFinding[] {
  return findings
    .map((finding) => {
      const normalized = {
        id:
          finding.id ??
          `cp_audit_finding_${hashJson({
            severity: finding.severity,
            statement: finding.statement,
            evidenceRoot: finding.evidenceRoot ? normalizeSha256(finding.evidenceRoot) : null,
          }).slice(0, 24)}`,
        severity: finding.severity,
        statement: finding.statement,
        ...(finding.evidenceRoot ? { evidenceRoot: normalizeSha256(finding.evidenceRoot) } : {}),
      } satisfies CanopyProofAuditFinding;
      return normalized;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function assertDecisionMatchesFindings(decision: CanopyProofAuditAttestationDecision, findings: readonly CanopyProofAuditFinding[]) {
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasHigh = findings.some((finding) => finding.severity === "high");
  if (decision === "attest" && (hasHigh || hasCritical)) {
    throw new Error("CanopyProof clean audit attestation cannot include high or critical unresolved findings.");
  }
  if (decision === "reject" && findings.length === 0) {
    throw new Error("CanopyProof rejected audit attestation requires at least one finding.");
  }
}

function assertSafeAuditAttestationText(values: readonly string[]) {
  const unsafeClaims = [
    /certified\s+carbon\s+credit/i,
    /carbon[-\s]?tax\s+offset/i,
    /guaranteed\s+(?:rwa\s+)?yield/i,
    /automatic\s+(?:\$?canopy|canopy)\s+distribution/i,
    /mainnet\s+funds/i,
  ] as const;
  for (const value of values) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited)\b/i.test(value)) {
        throw new Error(`CanopyProof audit attestation contains unsupported public claim: ${value}`);
      }
    }
  }
}
