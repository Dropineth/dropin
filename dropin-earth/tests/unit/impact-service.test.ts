import assert from "node:assert/strict";
import test from "node:test";
import { CertificateService } from "../../services/api/src/domain/impact/certificate-service.js";
import { EvidenceService } from "../../services/api/src/domain/impact/evidence-service.js";
import { computeEvidenceHash, computeEvidenceRoot } from "../../services/api/src/domain/impact/impact-engine.js";
import { ImpactService } from "../../services/api/src/domain/impact/impact-service.js";
import { InMemoryImpactRepository } from "../../services/api/src/domain/impact/impact-repository.js";

const projectInput = {
  title: "Sahel Field Proof Project",
  regionId: "region_ggw_sahel",
  operator: "Field Operator Cooperative",
  targetTreeCount: 1200,
  targetSpecies: ["Faidherbia albida"],
  budgetAmount: "3600",
  status: "draft",
} as const;

const evidenceInput = {
  projectId: "project_v1_ggw_demo",
  treeClusterId: "cluster_v1_ggw_demo",
  kind: "photo",
  uri: "r2://dropin/evidence/test-photo.jpg",
  rawContent: "photo-bytes-for-test",
  submittedBy: "validator_test_1",
} as const;

test("project creation persists project and writes audit log", async () => {
  const repo = new InMemoryImpactRepository();
  const service = new ImpactService(repo);

  const project = await service.createProject(projectInput, "test-admin");

  assert.equal(project.title, projectInput.title);
  assert.equal(project.status, "draft");
  assert.ok(repo.auditLogs.some((log) => log.action === "project.create" && log.entityId === project.id));
});

test("milestone creation persists milestone and writes audit log", async () => {
  const repo = new InMemoryImpactRepository();
  const service = new ImpactService(repo);

  const milestone = await service.createMilestone(
    "project_v1_ggw_demo",
    {
      title: "Verify first proof batch",
      amount: "500",
      status: "approved",
    },
    "test-admin",
  );

  assert.equal(milestone.projectId, "project_v1_ggw_demo");
  assert.equal(milestone.status, "approved");
  assert.ok(repo.auditLogs.some((log) => log.action === "project_milestone.create" && log.entityId === milestone.id));
});

test("evidence upload hashes raw content deterministically", async () => {
  const service = new EvidenceService(new InMemoryImpactRepository());

  const evidence = await service.uploadEvidence(evidenceInput);

  assert.equal(evidence.status, "hashed");
  assert.equal(
    evidence.sha256Hash,
    computeEvidenceHash({
      uri: evidenceInput.uri,
      rawContent: evidenceInput.rawContent,
    }),
  );
});

test("evidence review can accept and reject with audit trail", async () => {
  const repo = new InMemoryImpactRepository();
  const service = new EvidenceService(repo);
  const accepted = await service.uploadEvidence(evidenceInput);
  const rejected = await service.uploadEvidence({
    ...evidenceInput,
    uri: "r2://dropin/evidence/rejected-photo.jpg",
    rawContent: "bad-photo",
  });

  const acceptedResult = await service.reviewEvidence(accepted.id, { status: "accepted", reviewer: "reviewer_1" });
  const rejectedResult = await service.reviewEvidence(rejected.id, { status: "rejected", reviewer: "reviewer_1" });

  assert.equal(acceptedResult.status, "accepted");
  assert.equal(rejectedResult.status, "rejected");
  assert.ok(repo.auditLogs.some((log) => log.action === "evidence.accepted"));
  assert.ok(repo.auditLogs.some((log) => log.action === "evidence.rejected"));
});

test("certificate issuance rejects evidence that has not been accepted", async () => {
  const repo = new InMemoryImpactRepository();
  const evidenceService = new EvidenceService(repo);
  const certificateService = new CertificateService(repo);
  const evidence = await evidenceService.uploadEvidence(evidenceInput);

  await assert.rejects(
    () =>
      certificateService.issueCertificate({
        projectId: "project_v1_ggw_demo",
        treeClusterId: "cluster_v1_ggw_demo",
        evidenceIds: [evidence.id],
        verifiedTreeCount: 10,
        survivalRateEstimate: 0.7,
        estimatedCo2eLow: "1.2",
        estimatedCo2eHigh: "2.1",
        methodologyVersion: "impact-v1-pre-mrv",
      }),
    /accepted before certificate/,
  );
});

test("certificate issuance creates deterministic evidence root", async () => {
  const repo = new InMemoryImpactRepository();
  const evidenceService = new EvidenceService(repo);
  const certificateService = new CertificateService(repo);
  const firstEvidence = await evidenceService.uploadEvidence(evidenceInput);
  const secondEvidence = await evidenceService.uploadEvidence({
    ...evidenceInput,
    kind: "gps",
    uri: "r2://dropin/evidence/test-gps.json",
    rawContent: "gps-bytes-for-test",
  });
  await evidenceService.reviewEvidence(firstEvidence.id, { status: "accepted" });
  await evidenceService.reviewEvidence(secondEvidence.id, { status: "accepted" });

  const firstCertificate = await certificateService.issueCertificate({
    projectId: "project_v1_ggw_demo",
    treeClusterId: "cluster_v1_ggw_demo",
    evidenceIds: [firstEvidence.id, secondEvidence.id],
    verifiedTreeCount: 22,
    survivalRateEstimate: 0.75,
    estimatedCo2eLow: "2.2",
    estimatedCo2eHigh: "4.1",
    methodologyVersion: "impact-v1-pre-mrv",
  });
  const secondCertificate = await certificateService.issueCertificate({
    projectId: "project_v1_ggw_demo",
    treeClusterId: "cluster_v1_ggw_demo",
    evidenceIds: [secondEvidence.id, firstEvidence.id],
    verifiedTreeCount: 22,
    survivalRateEstimate: 0.75,
    estimatedCo2eLow: "2.2",
    estimatedCo2eHigh: "4.1",
    methodologyVersion: "impact-v1-pre-mrv",
  });

  assert.equal(firstCertificate.evidenceRoot, secondCertificate.evidenceRoot);
  assert.equal(firstCertificate.evidenceRoot, computeEvidenceRoot([firstEvidence, secondEvidence]));
  assert.ok(repo.auditLogs.some((log) => log.action === "impact_certificate.issue"));
});

test("certificate challenge marks certificate challenged and records challenge/audit", async () => {
  const repo = new InMemoryImpactRepository();
  const certificateService = new CertificateService(repo);

  const result = await certificateService.challengeCertificate("cert_v1_ggw_demo", {
    challenger: "red_team_1",
    severity: "high",
    title: "Duplicate evidence suspicion",
    attackScenario: "A red-team reviewer found that the same photo may have been reused across projects.",
    evidenceHash: "challenge-proof-hash",
    bondAmount: "10",
  });

  assert.equal(result.certificate.status, "challenged");
  assert.equal(result.challenge.targetId, "cert_v1_ggw_demo");
  assert.ok(repo.auditLogs.some((log) => log.action === "impact_certificate.challenge"));
});
