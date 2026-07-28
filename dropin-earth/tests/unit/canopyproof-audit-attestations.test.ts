import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofAuditAttestationService } from "../../services/api/src/domain/canopyproof/audit-attestations.js";

function headers(role: string, actorId = `${role}_audit_attestation_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function attestationPayload(id: string, decision: "attest" | "qualified" | "reject" = "attest") {
  return {
    id,
    scope: "proof_record",
    subjectId: "cp_record_audit_attestation_subject_001",
    auditorOrganizationId: "cp_org_independent_auditor_001",
    auditorName: "Independent Sahel Audit Lab",
    methods: ["audit_chain_replay", "evidence_sample_review"],
    standards: ["ISAE_3000", "UN_SDG_EVIDENCE"],
    sourceEventRoots: ["a".repeat(64), `sha256:${"b".repeat(64)}`],
    auditVerificationRoot: "c".repeat(64),
    findings:
      decision === "attest"
        ? [
            {
              severity: "low",
              statement: "Sampled evidence roots and governance references are reproducible from the submitted audit bundle.",
              evidenceRoot: "d".repeat(64),
            },
          ]
        : [
            {
              severity: decision === "reject" ? "critical" : "medium",
              statement: "Reviewer noted a bounded methodology limitation that must remain visible in public reporting.",
              evidenceRoot: "e".repeat(64),
            },
          ],
    decision,
    independenceStatement: "Auditor organization has no project fund control, no payout authority, and no proof issuance authority.",
    limitations: ["Desk review only; field inspection sample size is disclosed in the finding bundle."],
    publicSummary: "Independent audit attestation over a CanopyProof Environmental Proof Record lineage bundle.",
    issuedAt: "2026-07-09T00:00:00.000Z",
  };
}

test("CanopyProof audit attestation service creates independent hash-rooted attestations", () => {
  const service = new CanopyProofAuditAttestationService();
  const attestation = service.createAttestation(attestationPayload("cp_audit_attestation_domain_001"), "verifier_audit_attestation_domain");

  assert.equal(attestation.id, "cp_audit_attestation_domain_001");
  assert.equal(attestation.scope, "proof_record");
  assert.equal(attestation.decision, "attest");
  assert.deepEqual(attestation.methods, ["audit_chain_replay", "evidence_sample_review"]);
  assert.deepEqual(attestation.standards, ["ISAE_3000", "UN_SDG_EVIDENCE"]);
  assert.equal(attestation.sourceEventRoots.length, 2);
  assert.equal(attestation.sourceEventRoots[1], "b".repeat(64));
  assert.match(attestation.sourceEventRoot, /^[a-f0-9]{64}$/);
  assert.match(attestation.findingRoot, /^[a-f0-9]{64}$/);
  assert.match(attestation.attestationHash, /^[a-f0-9]{64}$/);
  assert.equal(attestation.auditEvent.entityType, "audit_attestation");
  assert.equal(attestation.auditEvent.action, "ASSERT");
  assert.equal(attestation.claimBoundary.notCarbonCredit, true);
  assert.equal(attestation.claimBoundary.notFinancialAsset, true);
  assert.equal(attestation.claimBoundary.notTaxOffset, true);
  assert.equal(attestation.claimBoundary.notGuaranteedYield, true);
  assert.equal(attestation.claimBoundary.notAutomaticCanopyDistribution, true);

  const status = service.getStatus();
  assert.equal(status.attestationCount, 1);
  assert.equal(status.rejectedCount, 0);
  assert.equal(status.safety.independentAuditorRequired, true);
  assert.equal(status.safety.noFinancialOrCarbonCreditAuthority, true);
});

test("CanopyProof audit attestation service preserves adverse findings and rejects unsafe claims", () => {
  const service = new CanopyProofAuditAttestationService();

  assert.throws(
    () =>
      service.createAttestation(
        {
          ...attestationPayload("cp_audit_attestation_invalid_clean_001"),
          findings: [
            {
              severity: "high",
              statement: "High-severity unresolved gap cannot be hidden behind a clean attestation.",
            },
          ],
        },
        "verifier_audit_attestation_domain",
      ),
    /cannot include high or critical/,
  );

  assert.throws(
    () =>
      service.createAttestation(
        {
          ...attestationPayload("cp_audit_attestation_unsafe_001"),
          publicSummary: "This audit attestation creates a certified carbon credit for the project.",
        },
        "verifier_audit_attestation_domain",
      ),
    /unsupported public claim/,
  );

  const rejected = service.createAttestation(attestationPayload("cp_audit_attestation_rejected_001", "reject"), "verifier_audit_attestation_domain");
  assert.equal(rejected.decision, "reject");
  assert.equal(rejected.auditEvent.action, "CHALLENGE");
  assert.equal(service.getStatus().rejectedCount, 1);
});

test("CanopyProof audit attestation API enforces RBAC and exposes institutional review records", async () => {
  const denied = await app.request("/canopyproof/audit/attestations", {
    method: "POST",
    headers: headers("community", "community_audit_attestation_denied"),
    body: JSON.stringify(attestationPayload("cp_audit_attestation_api_denied_001")),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/audit/attestations", {
    method: "POST",
    headers: headers("verifier", "verifier_audit_attestation_api"),
    body: JSON.stringify(attestationPayload("cp_audit_attestation_api_001", "qualified")),
  });
  assert.equal(created.status, 202);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      scope: string;
      subjectId: string;
      decision: string;
      findings: Array<{ severity: string }>;
      auditEvent: { entityType: string; action: string };
      claimBoundary: { notCarbonCredit: true; notFinancialAsset: true };
    };
  }>(created);
  assert.equal(createdBody.data.id, "cp_audit_attestation_api_001");
  assert.equal(createdBody.data.decision, "qualified");
  assert.equal(createdBody.data.findings[0]?.severity, "medium");
  assert.equal(createdBody.data.auditEvent.entityType, "audit_attestation");
  assert.equal(createdBody.data.auditEvent.action, "CHALLENGE");
  assert.equal(createdBody.data.claimBoundary.notCarbonCredit, true);
  assert.equal(createdBody.data.claimBoundary.notFinancialAsset, true);

  const listed = await app.request(
    "/canopyproof/audit/attestations?scope=proof_record&decision=qualified&subjectId=cp_record_audit_attestation_subject_001",
    {
      headers: headers("observer", "observer_audit_attestation_list"),
    },
  );
  assert.equal(listed.status, 200);
  const listedBody = await json<{ ok: true; data: Array<{ id: string; decision: string }> }>(listed);
  assert.ok(listedBody.data.some((item) => item.id === "cp_audit_attestation_api_001" && item.decision === "qualified"));

  const detail = await app.request("/canopyproof/audit/attestations/cp_audit_attestation_api_001", {
    headers: headers("observer", "observer_audit_attestation_detail"),
  });
  assert.equal(detail.status, 200);

  const invalidScope = await app.request("/canopyproof/audit/attestations?scope=carbon_credit", {
    headers: headers("observer", "observer_audit_attestation_invalid"),
  });
  assert.equal(invalidScope.status, 400);
});

test("CanopyProof SQL contract stores append-only institutional audit attestations", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit\.attestations/);
  assert.match(sql, /scope text NOT NULL CHECK \(scope IN \('evidence', 'proof_record', 'organization', 'funding', 'governance', 'reporting', 'system'\)\)/);
  assert.match(sql, /decision text NOT NULL CHECK \(decision IN \('attest', 'qualified', 'reject'\)\)/);
  assert.match(sql, /CHECK \(array_length\(source_event_roots, 1\) > 0\)/);
  assert.match(sql, /CHECK \(jsonb_array_length\(findings\) > 0 OR decision <> 'reject'\)/);
  assert.match(sql, /audit_attestations_no_update/);
  assert.match(sql, /audit_attestations_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON audit\.attestations/);
});
