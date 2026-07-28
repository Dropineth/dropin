import { hashJson } from "@dropin/crypto";

export const visualRightsStatuses = [
  "VERIFIED_EXPLICIT_RIGHTS",
  "STANDARD_LICENSE_VERIFIED",
  "RESTRICTED_CONTRACT",
  "EXPLICIT_RIGHTS_REQUIRED",
  "AMBIGUOUS_OR_CONFLICTING",
  "EXPIRED_OR_REVOKED",
  "PROHIBITED",
] as const;

export const visualLicenseActions = [
  "LAB_BENCHMARK",
  "INTERNAL_REVIEW",
  "MODEL_EVALUATION",
  "MODEL_TRAINING",
  "PRODUCTION_EVIDENCE_INPUT",
  "INSTITUTIONAL_EXPORT",
  "PUBLIC_DISPLAY",
  "PUBLIC_DATA_EXPORT",
] as const;

export const visualLicenseModifiers = [
  "ATTRIBUTION_REQUIRED",
  "SHARE_ALIKE_REQUIRED",
  "NONCOMMERCIAL_ONLY",
  "NO_DERIVATIVES",
  "NO_MODEL_TRAINING",
  "NO_INSTITUTIONAL_REDISTRIBUTION_BY_DEFAULT",
  "NO_PUBLIC_DISPLAY",
  "NO_PRECISE_LOCATION_DISCLOSURE",
  "NO_PRODUCTION_EVIDENCE",
  "CONSENT_REVIEW_REQUIRED",
  "JURISDICTION_REVIEW_REQUIRED",
  "DATA_RESIDENCY_REQUIRED",
] as const;

export type VisualRightsStatus = (typeof visualRightsStatuses)[number];
export type VisualLicenseAction = (typeof visualLicenseActions)[number];
export type VisualLicenseModifier = (typeof visualLicenseModifiers)[number];

export type VisualLicenseAttribution = {
  readonly title: string;
  readonly creators: readonly string[];
  readonly sourceUrl: string;
  readonly licenseName: string;
  readonly licenseUrl: string;
  readonly doi?: string;
  readonly modificationNoticeRequired: boolean;
};

export type VisualLicensePolicy = {
  readonly id: string;
  readonly version: number;
  readonly sourceProvider: string;
  readonly sourceDataset: string;
  readonly sourceAssetRoots: readonly string[];
  readonly rightsStatus: VisualRightsStatus;
  readonly licenseIdentifier?: string;
  readonly canonicalTermsUrl?: string;
  readonly rightsEvidenceRoots: readonly string[];
  readonly permittedActions: readonly VisualLicenseAction[];
  readonly prohibitedActions: readonly VisualLicenseAction[];
  readonly modifiers: readonly VisualLicenseModifier[];
  readonly attribution?: VisualLicenseAttribution;
  readonly effectiveAt: string;
  readonly expiresAt?: string;
  readonly reviewAt?: string;
  readonly policyRoot: string;
};

export type VisualLicenseDecision = {
  readonly allowed: boolean;
  readonly action: VisualLicenseAction;
  readonly policyId: string;
  readonly policyRoot: string;
  readonly reason:
    | "ACTION_EXPLICITLY_PERMITTED"
    | "RIGHTS_NOT_VERIFIED"
    | "ACTION_NOT_PERMITTED"
    | "ACTION_EXPLICITLY_PROHIBITED"
    | "POLICY_NOT_EFFECTIVE"
    | "POLICY_EXPIRED"
    | "ATTRIBUTION_MISSING"
    | "MODEL_TRAINING_PROHIBITED"
    | "PRODUCTION_EVIDENCE_PROHIBITED"
    | "PUBLIC_DISPLAY_PROHIBITED"
    | "INSTITUTIONAL_REDISTRIBUTION_PROHIBITED";
  readonly evaluatedAt: string;
  readonly decisionRoot: string;
};

const DENIED_RIGHTS_STATUSES = new Set<VisualRightsStatus>([
  "EXPLICIT_RIGHTS_REQUIRED",
  "AMBIGUOUS_OR_CONFLICTING",
  "EXPIRED_OR_REVOKED",
  "PROHIBITED",
]);

function canonicalStrings(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function parseTime(value: string, field: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`CanopyProof visual license ${field} must be an RFC3339 timestamp.`);
  }
  return milliseconds;
}

function assertHttpUrl(value: string, field: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`CanopyProof visual license ${field} must be an HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`CanopyProof visual license ${field} must be an HTTPS URL.`);
  }
}

export function createVisualLicensePolicy(
  input: Omit<VisualLicensePolicy, "id" | "policyRoot"> & { readonly id?: string },
): VisualLicensePolicy {
  if (!input.sourceProvider.trim() || !input.sourceDataset.trim()) {
    throw new Error("CanopyProof visual license policy requires source provider and dataset.");
  }
  if (input.version < 1 || !Number.isSafeInteger(input.version)) {
    throw new Error("CanopyProof visual license policy version must be a positive integer.");
  }
  const effectiveAtMs = parseTime(input.effectiveAt, "effectiveAt");
  if (input.expiresAt && parseTime(input.expiresAt, "expiresAt") <= effectiveAtMs) {
    throw new Error("CanopyProof visual license expiresAt must follow effectiveAt.");
  }
  if (input.reviewAt && parseTime(input.reviewAt, "reviewAt") <= effectiveAtMs) {
    throw new Error("CanopyProof visual license reviewAt must follow effectiveAt.");
  }
  if (input.canonicalTermsUrl) assertHttpUrl(input.canonicalTermsUrl, "canonicalTermsUrl");
  if (input.attribution) {
    assertHttpUrl(input.attribution.sourceUrl, "attribution.sourceUrl");
    assertHttpUrl(input.attribution.licenseUrl, "attribution.licenseUrl");
  }
  const normalized = {
    version: input.version,
    sourceProvider: input.sourceProvider.trim(),
    sourceDataset: input.sourceDataset.trim(),
    sourceAssetRoots: canonicalStrings(input.sourceAssetRoots),
    rightsStatus: input.rightsStatus,
    ...(input.licenseIdentifier ? { licenseIdentifier: input.licenseIdentifier.trim() } : {}),
    ...(input.canonicalTermsUrl ? { canonicalTermsUrl: input.canonicalTermsUrl } : {}),
    rightsEvidenceRoots: canonicalStrings(input.rightsEvidenceRoots),
    permittedActions: canonicalStrings(input.permittedActions) as readonly VisualLicenseAction[],
    prohibitedActions: canonicalStrings(input.prohibitedActions) as readonly VisualLicenseAction[],
    modifiers: canonicalStrings(input.modifiers) as readonly VisualLicenseModifier[],
    ...(input.attribution
      ? {
          attribution: {
            ...input.attribution,
            creators: canonicalStrings(input.attribution.creators),
          },
        }
      : {}),
    effectiveAt: new Date(effectiveAtMs).toISOString(),
    ...(input.expiresAt ? { expiresAt: new Date(parseTime(input.expiresAt, "expiresAt")).toISOString() } : {}),
    ...(input.reviewAt ? { reviewAt: new Date(parseTime(input.reviewAt, "reviewAt")).toISOString() } : {}),
  };
  const policyRoot = hashJson({ kind: "canopyproof-visual-license-policy-v1", ...normalized });
  return {
    id: input.id?.trim() || `cp_visual_license_${policyRoot.slice(0, 24)}`,
    ...normalized,
    policyRoot,
  };
}

export function evaluateVisualLicenseAction(
  policy: VisualLicensePolicy,
  action: VisualLicenseAction,
  evaluatedAt: string,
  options: Readonly<{ attributionIncluded?: boolean }> = {},
): VisualLicenseDecision {
  const evaluatedAtMs = parseTime(evaluatedAt, "decision evaluatedAt");
  const effectiveAtMs = parseTime(policy.effectiveAt, "effectiveAt");
  let reason: VisualLicenseDecision["reason"] = "ACTION_EXPLICITLY_PERMITTED";
  let allowed = true;

  if (evaluatedAtMs < effectiveAtMs) {
    allowed = false;
    reason = "POLICY_NOT_EFFECTIVE";
  } else if (policy.expiresAt && evaluatedAtMs >= parseTime(policy.expiresAt, "expiresAt")) {
    allowed = false;
    reason = "POLICY_EXPIRED";
  } else if (DENIED_RIGHTS_STATUSES.has(policy.rightsStatus)) {
    allowed = false;
    reason = "RIGHTS_NOT_VERIFIED";
  } else if (policy.prohibitedActions.includes(action)) {
    allowed = false;
    reason = "ACTION_EXPLICITLY_PROHIBITED";
  } else if (!policy.permittedActions.includes(action)) {
    allowed = false;
    reason = "ACTION_NOT_PERMITTED";
  } else if (action === "MODEL_TRAINING" && policy.modifiers.includes("NO_MODEL_TRAINING")) {
    allowed = false;
    reason = "MODEL_TRAINING_PROHIBITED";
  } else if (action === "PRODUCTION_EVIDENCE_INPUT" && policy.modifiers.includes("NO_PRODUCTION_EVIDENCE")) {
    allowed = false;
    reason = "PRODUCTION_EVIDENCE_PROHIBITED";
  } else if (
    (action === "PUBLIC_DISPLAY" || action === "PUBLIC_DATA_EXPORT") &&
    policy.modifiers.includes("NO_PUBLIC_DISPLAY")
  ) {
    allowed = false;
    reason = "PUBLIC_DISPLAY_PROHIBITED";
  } else if (
    action === "INSTITUTIONAL_EXPORT" &&
    policy.modifiers.includes("NO_INSTITUTIONAL_REDISTRIBUTION_BY_DEFAULT")
  ) {
    allowed = false;
    reason = "INSTITUTIONAL_REDISTRIBUTION_PROHIBITED";
  } else if (policy.modifiers.includes("ATTRIBUTION_REQUIRED") && options.attributionIncluded !== true) {
    allowed = false;
    reason = "ATTRIBUTION_MISSING";
  }

  const decisionSeed = {
    allowed,
    action,
    policyId: policy.id,
    policyRoot: policy.policyRoot,
    reason,
    evaluatedAt: new Date(evaluatedAtMs).toISOString(),
  };
  return {
    ...decisionSeed,
    decisionRoot: hashJson({ kind: "canopyproof-visual-license-decision-v1", ...decisionSeed }),
  };
}

export function evaluateVisualLicenseIntersection(
  policies: readonly VisualLicensePolicy[],
  action: VisualLicenseAction,
  evaluatedAt: string,
  options: Readonly<{ attributionPolicyIds?: readonly string[] }> = {},
) {
  if (policies.length === 0) {
    throw new Error("CanopyProof visual license intersection requires at least one policy.");
  }
  const attributedPolicies = new Set(options.attributionPolicyIds ?? []);
  const decisions = [...policies]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((policy) =>
      evaluateVisualLicenseAction(policy, action, evaluatedAt, {
        attributionIncluded: attributedPolicies.has(policy.id),
      }),
    );
  return {
    allowed: decisions.every((decision) => decision.allowed),
    action,
    decisions,
    intersectionRoot: hashJson({
      kind: "canopyproof-visual-license-intersection-v1",
      action,
      evaluatedAt,
      decisionRoots: decisions.map((decision) => decision.decisionRoot),
    }),
  };
}

export function createVineLidarLabLicensePolicy(effectiveAt: string): VisualLicensePolicy {
  return createVisualLicensePolicy({
    version: 1,
    sourceProvider: "Zenodo",
    sourceDataset: "VineLiDAR",
    sourceAssetRoots: [],
    rightsStatus: "STANDARD_LICENSE_VERIFIED",
    licenseIdentifier: "CC-BY-4.0",
    canonicalTermsUrl: "https://creativecommons.org/licenses/by/4.0/",
    rightsEvidenceRoots: [hashJson({ kind: "rights-evidence", doi: "10.5281/zenodo.8113105" })],
    permittedActions: ["LAB_BENCHMARK", "INTERNAL_REVIEW", "MODEL_EVALUATION"],
    prohibitedActions: ["PRODUCTION_EVIDENCE_INPUT"],
    modifiers: ["ATTRIBUTION_REQUIRED", "NO_PRODUCTION_EVIDENCE"],
    attribution: {
      title:
        "High resolution LiDAR dataset acquired using UAV over two vineyards and two years located in Tomino, Pontevedra, Spain",
      creators: ["Joao Valente", "Mar Ariza-Sentis", "Sergio Velez"],
      sourceUrl: "https://zenodo.org/records/8113105",
      licenseName: "Creative Commons Attribution 4.0 International",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      doi: "10.5281/zenodo.8113105",
      modificationNoticeRequired: true,
    },
    effectiveAt,
  });
}

export function createArielScansDefaultLicensePolicy(effectiveAt: string): VisualLicensePolicy {
  return createVisualLicensePolicy({
    version: 1,
    sourceProvider: "Voxel51 Hugging Face dataset card",
    sourceDataset: "ariel_scans imagery",
    sourceAssetRoots: [],
    rightsStatus: "EXPLICIT_RIGHTS_REQUIRED",
    rightsEvidenceRoots: [],
    permittedActions: [],
    prohibitedActions: [
      "INTERNAL_REVIEW",
      "MODEL_EVALUATION",
      "MODEL_TRAINING",
      "PRODUCTION_EVIDENCE_INPUT",
      "INSTITUTIONAL_EXPORT",
      "PUBLIC_DISPLAY",
      "PUBLIC_DATA_EXPORT",
    ],
    modifiers: [
      "NO_MODEL_TRAINING",
      "NO_INSTITUTIONAL_REDISTRIBUTION_BY_DEFAULT",
      "NO_PUBLIC_DISPLAY",
      "NO_PRECISE_LOCATION_DISCLOSURE",
      "NO_PRODUCTION_EVIDENCE",
    ],
    effectiveAt,
  });
}
