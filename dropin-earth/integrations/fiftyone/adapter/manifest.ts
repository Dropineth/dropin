import { hashJson } from "@dropin/crypto";
import type {
  CandidateFinding,
  ReviewQueueSnapshot,
  VisualSensorModality,
  VisualServiceActor,
} from "../../../services/api/src/domain/canopyproof/visual-evidence-types.js";
import { visualAuthorityActorRoot } from "../../../services/api/src/domain/canopyproof/visual-evidence-intelligence.js";
import type { VisualLicenseDecision } from "../../../services/api/src/domain/canopyproof/visual-license-policy.js";

export const fiftyOneReviewActions = [
  "LOAD_REVIEW_QUEUE",
  "INSPECT_CANDIDATE_PROVENANCE",
  "APPEND_REVIEW_DECISION",
  "REQUEST_SECOND_REVIEW",
  "CREATE_FIELD_VERIFICATION_TASK",
  "OPEN_CHALLENGE_DRAFT",
  "REGISTER_HARD_NEGATIVE",
] as const;

export const fiftyOneForbiddenActions = [
  "VERIFY_ENVIRONMENTAL_PROOF",
  "ISSUE_CERTIFICATE",
  "PUBLISH_ESG_METRIC",
  "RELEASE_FUNDING",
  "MODIFY_RAW_EVIDENCE",
  "MODIFY_REVIEW_QUEUE_SNAPSHOT",
  "CHANGE_LICENSE_POLICY",
  "CHANGE_GOVERNANCE",
] as const;

export type FiftyOneReviewAction = (typeof fiftyOneReviewActions)[number];
export type FiftyOneForbiddenAction = (typeof fiftyOneForbiddenActions)[number];

export type FiftyOneManifestSample = {
  readonly sampleId: string;
  readonly candidateIds: readonly string[];
  readonly mediaHandle: string;
  readonly assetRoot: string;
  readonly modality: VisualSensorModality;
  readonly locationDisclosure: "GENERALIZED" | "WITHHELD";
  readonly candidateProvenanceRoots: readonly string[];
};

export type FiftyOneUnsignedReviewManifest = {
  readonly schemaVersion: "canopyproof.visual-review-manifest.v1";
  readonly manifestId: string;
  readonly reviewQueueSnapshotId: string;
  readonly reviewQueueHash: string;
  readonly datasetSnapshotId: string;
  readonly datasetManifestHash: string;
  readonly tenantScopeHash: string;
  readonly organizationScopeHash: string;
  readonly projectScopeHash?: string;
  readonly subjectId: string;
  readonly audience: "canopyproof-fiftyone-review";
  readonly purpose: "human-visual-review";
  readonly samples: readonly FiftyOneManifestSample[];
  readonly modelRunIds: readonly string[];
  readonly allowedActions: readonly FiftyOneReviewAction[];
  readonly classificationCeiling: "INTERNAL" | "RESTRICTED";
  readonly licenseDecisionId: string;
  readonly licenseDecisionRoot: string;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly keyId: string;
  readonly payloadHash: string;
};

export type FiftyOneReviewManifest = FiftyOneUnsignedReviewManifest & {
  readonly signatureAlgorithm: "MANAGED-ASYMMETRIC";
  readonly signature: string;
};

export interface FiftyOneManifestSigner {
  readonly keyId: string;
  sign(payload: Uint8Array): Promise<string>;
}

export interface FiftyOneManifestVerifier {
  verify(input: Readonly<{ keyId: string; payload: Uint8Array; signature: string }>): Promise<boolean>;
}

export interface FiftyOneManifestReplayGuard {
  consume(input: Readonly<{ nonce: string; manifestId: string; subjectId: string; expiresAt: string }>): Promise<boolean>;
}

export type CreateFiftyOneManifestInput = {
  readonly queueSnapshot: ReviewQueueSnapshot;
  readonly candidates: readonly CandidateFinding[];
  readonly samples: readonly Omit<FiftyOneManifestSample, "candidateProvenanceRoots">[];
  readonly reviewerSubjectId: string;
  readonly allowedActions: readonly FiftyOneReviewAction[];
  readonly classificationCeiling: FiftyOneUnsignedReviewManifest["classificationCeiling"];
  readonly licenseDecision: VisualLicenseDecision;
  readonly issuedAt: string;
  readonly notBefore?: string;
  readonly expiresAt: string;
  readonly nonce: string;
};

const MAX_MANIFEST_LIFETIME_MS = 15 * 60 * 1_000;
const HASH_PATTERN = /^[a-f0-9]{32,128}$/i;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/;
const MEDIA_HANDLE_PATTERN = /^\/internal\/canopyproof\/visual-media\/[A-Za-z0-9_-]{16,256}$/;
const FORBIDDEN_KEY_PATTERN = /(secret|password|private.?key|credential|authorization|cookie|access.?token|refresh.?token|signed.?url|database.?url|bucket|object.?prefix)/i;
const FORBIDDEN_VALUE_PATTERN = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:postgres|mongodb|mysql):\/\/|(?:aws|gcp|r2)[_-]?(?:secret|token)|[?&](?:token|signature|sig|key)=)/i;

function parseTime(value: string, field: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`FiftyOne manifest ${field} must be RFC3339.`);
  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

function assertId(value: string, field: string) {
  if (!ID_PATTERN.test(value)) throw new Error(`FiftyOne manifest ${field} is invalid.`);
  return value;
}

function assertHash(value: string, field: string) {
  if (!HASH_PATTERN.test(value)) throw new Error(`FiftyOne manifest ${field} is not a canonical hash.`);
  return value.toLowerCase();
}

function uniqueOrdered<T extends string>(values: readonly T[], field: string) {
  if (values.length === 0 || new Set(values).size !== values.length) {
    throw new Error(`FiftyOne manifest ${field} must be non-empty and unique.`);
  }
  return [...values];
}

function assertNoSecretMaterial(value: unknown, path = "manifest"): void {
  if (typeof value === "string") {
    if (FORBIDDEN_VALUE_PATTERN.test(value)) throw new Error(`FiftyOne manifest contains forbidden material at ${path}.`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretMaterial(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) throw new Error(`FiftyOne manifest contains forbidden key ${path}.${key}.`);
    assertNoSecretMaterial(child, `${path}.${key}`);
  }
}

function canonicalPayloadBytes(payload: Omit<FiftyOneUnsignedReviewManifest, "payloadHash">) {
  return new TextEncoder().encode(
    hashJson({ kind: "canopyproof-fiftyone-manifest-signing-payload-v1", payload }),
  );
}

function canonicalManifestPayload(manifest: FiftyOneReviewManifest) {
  const payload: Record<string, unknown> = { ...manifest };
  delete payload.payloadHash;
  delete payload.signatureAlgorithm;
  delete payload.signature;
  return payload as Omit<FiftyOneUnsignedReviewManifest, "payloadHash">;
}

function verifyIssuer(actor: VisualServiceActor, queue: ReviewQueueSnapshot) {
  const expectedRoot = visualAuthorityActorRoot(actor);
  if (
    actor.authorityRoot !== expectedRoot ||
    actor.verificationStatus !== "verified" ||
    actor.capability !== "visual_manifest_issuance" ||
    actor.tenantId !== queue.tenantId ||
    actor.organizationId !== queue.organizationId
  ) {
    throw new Error("FiftyOne manifest issuer is not authorized for this queue.");
  }
}

export async function createFiftyOneReviewManifest(
  input: CreateFiftyOneManifestInput,
  issuer: VisualServiceActor,
  signer: FiftyOneManifestSigner,
): Promise<FiftyOneReviewManifest> {
  assertNoSecretMaterial(input);
  verifyIssuer(issuer, input.queueSnapshot);
  if (!input.licenseDecision.allowed || input.licenseDecision.action !== "INTERNAL_REVIEW") {
    throw new Error("FiftyOne manifest requires an allowed INTERNAL_REVIEW license decision.");
  }
  const issuedAt = parseTime(input.issuedAt, "issuedAt");
  const notBefore = parseTime(input.notBefore ?? input.issuedAt, "notBefore");
  const expiresAt = parseTime(input.expiresAt, "expiresAt");
  if (notBefore.milliseconds < issuedAt.milliseconds || expiresAt.milliseconds <= notBefore.milliseconds) {
    throw new Error("FiftyOne manifest time window is invalid.");
  }
  if (expiresAt.milliseconds - issuedAt.milliseconds > MAX_MANIFEST_LIFETIME_MS) {
    throw new Error("FiftyOne manifest lifetime exceeds 15 minutes.");
  }
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
  if (candidateById.size !== input.candidates.length) throw new Error("FiftyOne manifest candidates must be unique.");
  const expectedCandidateIds = input.queueSnapshot.candidateIds;
  if (
    expectedCandidateIds.length !== candidateById.size ||
    expectedCandidateIds.some((candidateId) => !candidateById.has(candidateId))
  ) {
    throw new Error("FiftyOne manifest candidates do not exactly match the immutable queue snapshot.");
  }
  const samples = input.samples.map((sample) => {
    assertId(sample.sampleId, "sampleId");
    if (!input.queueSnapshot.sampleIds.includes(sample.sampleId)) {
      throw new Error(`FiftyOne manifest sample ${sample.sampleId} is outside queue membership.`);
    }
    if (!MEDIA_HANDLE_PATTERN.test(sample.mediaHandle)) {
      throw new Error("FiftyOne manifest mediaHandle must be a bounded internal media path.");
    }
    const candidateIds = uniqueOrdered(sample.candidateIds, "sample candidateIds");
    const candidates = candidateIds.map((candidateId) => {
      const candidate = candidateById.get(candidateId);
      if (!candidate || candidate.sampleId !== sample.sampleId) {
        throw new Error(`FiftyOne manifest candidate ${candidateId} does not belong to sample ${sample.sampleId}.`);
      }
      if (
        candidate.tenantId !== input.queueSnapshot.tenantId ||
        candidate.organizationId !== input.queueSnapshot.organizationId ||
        candidate.projectId !== input.queueSnapshot.projectId
      ) {
        throw new Error("FiftyOne manifest candidate scope differs from queue scope.");
      }
      return candidate;
    });
    if (sample.locationDisclosure !== "GENERALIZED" && sample.locationDisclosure !== "WITHHELD") {
      throw new Error("FiftyOne manifest cannot disclose precise location.");
    }
    return {
      sampleId: sample.sampleId,
      candidateIds,
      mediaHandle: sample.mediaHandle,
      assetRoot: assertHash(sample.assetRoot, "assetRoot"),
      modality: sample.modality,
      locationDisclosure: sample.locationDisclosure,
      candidateProvenanceRoots: candidates.map((candidate) => candidate.factRoot).sort(),
    };
  });
  if (
    samples.length !== input.queueSnapshot.sampleIds.length ||
    input.queueSnapshot.sampleIds.some((sampleId) => !samples.some((sample) => sample.sampleId === sampleId))
  ) {
    throw new Error("FiftyOne manifest samples do not exactly match queue membership.");
  }
  const sortedSamples = [...samples].sort((left, right) => left.sampleId.localeCompare(right.sampleId));
  const allowedActions = [...new Set(input.allowedActions)].sort() as readonly FiftyOneReviewAction[];
  if (allowedActions.length === 0 || allowedActions.some((action) => !fiftyOneReviewActions.includes(action))) {
    throw new Error("FiftyOne manifest allowedActions are invalid.");
  }
  const manifestIdentitySeed = {
    reviewQueueSnapshotId: input.queueSnapshot.id,
    reviewQueueHash: input.queueSnapshot.reviewQueueHash,
    subjectId: input.reviewerSubjectId,
    issuedAt: issuedAt.iso,
    nonce: input.nonce,
  };
  const manifestId = `cp_fiftyone_manifest_${hashJson({
    kind: "canopyproof-fiftyone-manifest-id-v1",
    ...manifestIdentitySeed,
  }).slice(0, 24)}`;
  const payloadWithoutHash = {
    schemaVersion: "canopyproof.visual-review-manifest.v1" as const,
    manifestId,
    reviewQueueSnapshotId: input.queueSnapshot.id,
    reviewQueueHash: assertHash(input.queueSnapshot.reviewQueueHash, "reviewQueueHash"),
    datasetSnapshotId: input.queueSnapshot.datasetSnapshotId,
    datasetManifestHash: assertHash(input.queueSnapshot.datasetManifestHash, "datasetManifestHash"),
    tenantScopeHash: hashJson({ kind: "canopyproof-fiftyone-tenant-scope-v1", tenantId: input.queueSnapshot.tenantId }),
    organizationScopeHash: hashJson({
      kind: "canopyproof-fiftyone-organization-scope-v1",
      organizationId: input.queueSnapshot.organizationId,
    }),
    ...(input.queueSnapshot.projectId
      ? {
          projectScopeHash: hashJson({
            kind: "canopyproof-fiftyone-project-scope-v1",
            projectId: input.queueSnapshot.projectId,
          }),
        }
      : {}),
    subjectId: assertId(input.reviewerSubjectId, "subjectId"),
    audience: "canopyproof-fiftyone-review" as const,
    purpose: "human-visual-review" as const,
    samples: sortedSamples,
    modelRunIds: uniqueOrdered(input.queueSnapshot.modelRunIds, "modelRunIds"),
    allowedActions,
    classificationCeiling: input.classificationCeiling,
    licenseDecisionId: `cp_visual_license_decision_${input.licenseDecision.decisionRoot.slice(0, 24)}`,
    licenseDecisionRoot: assertHash(input.licenseDecision.decisionRoot, "licenseDecisionRoot"),
    issuedAt: issuedAt.iso,
    notBefore: notBefore.iso,
    expiresAt: expiresAt.iso,
    nonce: assertId(input.nonce, "nonce"),
    keyId: assertId(signer.keyId, "keyId"),
  };
  assertNoSecretMaterial(payloadWithoutHash);
  const payloadHash = hashJson({ kind: "canopyproof-fiftyone-manifest-payload-v1", ...payloadWithoutHash });
  const unsigned: FiftyOneUnsignedReviewManifest = { ...payloadWithoutHash, payloadHash };
  const signature = await signer.sign(canonicalPayloadBytes(payloadWithoutHash));
  if (!signature.trim()) throw new Error("FiftyOne manifest signer returned an empty signature.");
  return {
    ...unsigned,
    signatureAlgorithm: "MANAGED-ASYMMETRIC",
    signature,
  };
}

export async function verifyFiftyOneReviewManifest(
  manifest: FiftyOneReviewManifest,
  input: Readonly<{
    now: string;
    subjectId: string;
    queueSnapshot: ReviewQueueSnapshot;
    verifier: FiftyOneManifestVerifier;
    replayGuard?: FiftyOneManifestReplayGuard;
  }>,
) {
  assertNoSecretMaterial(manifest);
  if (manifest.schemaVersion !== "canopyproof.visual-review-manifest.v1") {
    throw new Error("FiftyOne manifest schema version is unsupported.");
  }
  if (manifest.audience !== "canopyproof-fiftyone-review" || manifest.purpose !== "human-visual-review") {
    throw new Error("FiftyOne manifest audience or purpose is invalid.");
  }
  if (manifest.subjectId !== input.subjectId) throw new Error("FiftyOne manifest subject mismatch.");
  if (
    manifest.reviewQueueSnapshotId !== input.queueSnapshot.id ||
    manifest.reviewQueueHash !== input.queueSnapshot.reviewQueueHash ||
    manifest.datasetSnapshotId !== input.queueSnapshot.datasetSnapshotId ||
    manifest.datasetManifestHash !== input.queueSnapshot.datasetManifestHash
  ) {
    throw new Error("FiftyOne manifest queue or dataset hash mismatch.");
  }
  const now = parseTime(input.now, "verification time");
  const notBefore = parseTime(manifest.notBefore, "notBefore");
  const expiresAt = parseTime(manifest.expiresAt, "expiresAt");
  if (now.milliseconds < notBefore.milliseconds || now.milliseconds >= expiresAt.milliseconds) {
    throw new Error("FiftyOne manifest is not currently valid.");
  }
  const payload = canonicalManifestPayload(manifest);
  const expectedPayloadHash = hashJson({ kind: "canopyproof-fiftyone-manifest-payload-v1", ...payload });
  if (manifest.payloadHash !== expectedPayloadHash) throw new Error("FiftyOne manifest payload hash mismatch.");
  const signatureValid = await input.verifier.verify({
    keyId: manifest.keyId,
    payload: canonicalPayloadBytes(payload),
    signature: manifest.signature,
  });
  if (!signatureValid) throw new Error("FiftyOne manifest signature is invalid.");
  if (input.replayGuard) {
    const consumed = await input.replayGuard.consume({
      nonce: manifest.nonce,
      manifestId: manifest.manifestId,
      subjectId: manifest.subjectId,
      expiresAt: manifest.expiresAt,
    });
    if (!consumed) throw new Error("FiftyOne manifest nonce was already consumed or revoked.");
  }
  return {
    valid: true as const,
    manifestId: manifest.manifestId,
    reviewQueueSnapshotId: manifest.reviewQueueSnapshotId,
    payloadHash: manifest.payloadHash,
    allowedActions: manifest.allowedActions,
  };
}

export function assertFiftyOneActionAllowed(
  manifest: Pick<FiftyOneReviewManifest, "allowedActions" | "expiresAt" | "subjectId">,
  input: Readonly<{ action: FiftyOneReviewAction | FiftyOneForbiddenAction; subjectId: string; now: string }>,
) {
  if (fiftyOneForbiddenActions.includes(input.action as FiftyOneForbiddenAction)) {
    throw new Error(`FiftyOne action ${input.action} is permanently forbidden.`);
  }
  if (!fiftyOneReviewActions.includes(input.action as FiftyOneReviewAction)) {
    throw new Error(`FiftyOne action ${input.action} is unknown.`);
  }
  if (manifest.subjectId !== input.subjectId) throw new Error("FiftyOne action subject mismatch.");
  if (Date.parse(input.now) >= Date.parse(manifest.expiresAt)) throw new Error("FiftyOne action manifest expired.");
  if (!manifest.allowedActions.includes(input.action as FiftyOneReviewAction)) {
    throw new Error(`FiftyOne action ${input.action} is outside the manifest capability.`);
  }
  return true;
}
