import { evidenceHash, hashHex, hashJson, merkleRoot } from "@dropin/crypto";
import type { EvidenceObject, ImpactCertificate } from "@dropin/schemas";

export function computeEvidenceHash(input: {
  uri: string;
  rawContent?: string | undefined;
  content?: string | undefined;
  contentHash?: string | undefined;
}) {
  if (input.contentHash) {
    return input.contentHash.toLowerCase();
  }

  const content = input.rawContent ?? input.content;
  if (!content) {
    throw new Error("Evidence hash requires rawContent, content, or contentHash.");
  }

  return evidenceHash(content, input.uri);
}

export function computeEvidenceRoot(evidenceObjects: readonly EvidenceObject[]) {
  return merkleRoot(
    evidenceObjects
      .map((evidence) => evidence.sha256Hash)
      .sort((left, right) => left.localeCompare(right)),
  );
}

export function computeCertificateHash(certificate: ImpactCertificate) {
  return hashJson({
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
    status: certificate.status,
  });
}

export function mockValidatorSignature(certificate: ImpactCertificate) {
  return `validator:${hashHex(computeCertificateHash(certificate)).slice(0, 32)}`;
}

export function certificateDisclosure(certificate: ImpactCertificate) {
  return {
    ...certificate,
    certificateHash: computeCertificateHash(certificate),
    claimBoundary:
      "This is an Impact Certificate, not a certified carbon credit. Estimated CO2e is estimated impact only and cannot support offset or tax claims.",
  };
}
