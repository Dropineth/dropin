import { hashJson, merkleRoot } from "@dropin/crypto";
import type { EvidenceObject, SettlementCertificate } from "@dropin/schemas";

export function decimalBpsAmount(totalAmount: string, bps: number) {
  const value = Number.parseFloat(totalAmount);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${totalAmount}`);
  }
  return ((value * bps) / 10_000).toFixed(6).replace(/\.?0+$/, "") || "0";
}

export function computeSettlementEvidenceRoot(evidence: readonly EvidenceObject[]) {
  return merkleRoot(
    evidence
      .filter((item) => item.status === "accepted")
      .map((item) => item.sha256Hash)
      .sort((left, right) => left.localeCompare(right)),
  );
}

export function computeSettlementCertificateHash(input: {
  projectId: string;
  milestoneId: string;
  evidenceRoot: string;
  amount: string;
  currency: string;
  certificateId?: string | undefined;
  finalSettlement: boolean;
}) {
  return hashJson({
    kind: "dropin-settlement-certificate-v1",
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    evidenceRoot: input.evidenceRoot,
    amount: input.amount,
    currency: input.currency,
    certificateId: input.certificateId ?? null,
    finalSettlement: input.finalSettlement,
  });
}

export function settlementDisclosure(settlement: SettlementCertificate) {
  return {
    ...settlement,
    claimBoundary:
      "This settlement certificate records internal fund and evidence settlement. It is not a carbon credit, payment rail receipt, or tax offset claim.",
  };
}
