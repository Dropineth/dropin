import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofAuditExportManifestService } from "../../services/api/src/domain/canopyproof/audit-export-manifests.js";

function headers(role: string, actorId = `${role}_audit_export_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function manifestPayload(id: string, classification: "public" | "internal" | "restricted" | "confidential" = "restricted") {
  return {
    id,
    kind: "institutional_audit_packet",
    scope: "proof_record",
    subjectId: "cp_record_export_manifest_subject_001",
    requesterOrganizationId: "cp_org_export_manifest_requester_001",
    purpose: "Institutional auditor review of proof record lineage and public-record challenge posture.",
    classification,
    entries: [
      {
        id: "cp_export_entry_public_record_001",
        resourceType: "public_record",
        resourceId: "cp_public_record_export_manifest_001",
        contentHash: "a".repeat(64),
        eventRoot: "b".repeat(64),
        classification: "public",
        redactionPolicy: "public_safe",
        included: true,
        reason: "Public Environmental Proof Record projection included for transparency review.",
      },
      {
        id: "cp_export_entry_audit_attestation_001",
        resourceType: "audit_attestation",
        resourceId: "cp_audit_attestation_export_manifest_001",
        contentHash: `sha256:${"c".repeat(64)}`,
        eventRoot: "d".repeat(64),
        classification: classification === "confidential" ? "confidential" : "restricted",
        redactionPolicy: "confidential_hash_only",
        included: true,
        reason: "Hash-only independent auditor attestation entry included without raw evidence payload.",
      },
    ],
    expiresAt: "2027-07-09T00:00:00.000Z",
    createdAt: "2026-07-09T00:00:00.000Z",
  };
}

test("CanopyProof audit export manifest service creates hash-only institutional data-room manifests", () => {
  const service = new CanopyProofAuditExportManifestService();
  const manifest = service.createManifest(manifestPayload("cp_audit_export_manifest_domain_001"), "verifier_audit_export_domain");

  assert.equal(manifest.manifestVersion, "canopyproof_audit_export_manifest_v1");
  assert.equal(manifest.scope, "proof_record");
  assert.equal(manifest.classification, "restricted");
  assert.equal(manifest.entries.length, 2);
  assert.equal(manifest.entries.find((entry) => entry.resourceType === "audit_attestation")?.contentHash, "c".repeat(64));
  assert.match(manifest.entryRoot, /^[a-f0-9]{64}$/);
  assert.match(manifest.redactionRoot, /^[a-f0-9]{64}$/);
  assert.match(manifest.sourceEventRoot, /^[a-f0-9]{64}$/);
  assert.match(manifest.exportHash, /^[a-f0-9]{64}$/);
  assert.equal(manifest.safety.hashOnlyManifest, true);
  assert.equal(manifest.safety.rawEvidenceExcluded, true);
  assert.equal(manifest.safety.noFinancialOrCarbonCreditAuthority, true);
  assert.equal(manifest.auditEvent.entityType, "audit_export_manifest");
  assert.equal(manifest.auditEvent.action, "DELEGATE");

  const status = service.getStatus();
  assert.equal(status.manifestCount, 1);
  assert.equal(status.restrictedOrConfidentialCount, 1);
  assert.equal(status.safety.noRawEvidencePayloads, true);
});

test("CanopyProof audit export manifest service blocks unsafe or under-classified exports", () => {
  const service = new CanopyProofAuditExportManifestService();

  assert.throws(
    () =>
      service.createManifest(
        {
          ...manifestPayload("cp_audit_export_manifest_underclassified_001"),
          classification: "internal",
        },
        "verifier_audit_export_domain",
      ),
    /classification cannot be lower/,
  );

  assert.throws(
    () =>
      service.createManifest(
        {
          ...manifestPayload("cp_audit_export_manifest_unsafe_001"),
          purpose: "Export manifest for a certified carbon credit issuance package.",
        },
        "verifier_audit_export_domain",
      ),
    /unsupported public claim/,
  );

  assert.throws(
    () =>
      service.createManifest(
        {
          ...manifestPayload("cp_audit_export_manifest_private_contact_001"),
          purpose: "Send the governed export package to private-reviewer@example.org.",
        },
        "verifier_audit_export_domain",
      ),
    /unsupported public claim/,
  );

  assert.throws(
    () =>
      service.createManifest(
        {
          ...manifestPayload("cp_audit_export_manifest_bad_redaction_001"),
          entries: [
            {
              resourceType: "evidence",
              resourceId: "cp_evidence_sensitive_001",
              contentHash: "f".repeat(64),
              classification: "restricted",
              redactionPolicy: "public_safe",
              included: true,
              reason: "Restricted evidence cannot be exported with public-safe redaction only.",
            },
          ],
        },
        "verifier_audit_export_domain",
      ),
    /restricted export entries require/,
  );

  assert.throws(
    () =>
      service.createManifest(
        {
          ...manifestPayload("cp_audit_export_manifest_expired_001"),
          expiresAt: "2026-07-08T00:00:00.000Z",
        },
        "verifier_audit_export_domain",
      ),
    /expiration must follow creation/,
  );
});

test("CanopyProof audit export manifest snapshots recompute roots and reject tampering", () => {
  const source = new CanopyProofAuditExportManifestService();
  const manifest = source.createManifest(
    manifestPayload("cp_audit_export_manifest_snapshot_001"),
    "verifier_audit_export_snapshot",
  );
  const hydrated = CanopyProofAuditExportManifestService.fromAuthoritySnapshot({ manifests: [manifest] });
  assert.equal(hydrated.getManifest(manifest.id, true).exportHash, manifest.exportHash);
  assert.equal(hydrated.getStatus(manifest.requesterOrganizationId).manifestCount, 1);

  assert.throws(
    () =>
      CanopyProofAuditExportManifestService.fromAuthoritySnapshot({
        manifests: [{ ...manifest, entryRoot: "f".repeat(64) }],
      }),
    /deterministic root is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofAuditExportManifestService.fromAuthoritySnapshot({
        manifests: [
          {
            ...manifest,
            auditEvent: { ...manifest.auditEvent, actor: "different_snapshot_actor" },
          },
        ],
      }),
    /semantic event binding is invalid/,
  );
});

test("CanopyProof audit export manifest API filters sensitive manifests for observers", async () => {
  const denied = await app.request("/canopyproof/audit/export-manifests", {
    method: "POST",
    headers: headers("community", "community_audit_export_denied"),
    body: JSON.stringify(manifestPayload("cp_audit_export_manifest_api_denied_001")),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/audit/export-manifests", {
    method: "POST",
    headers: headers("verifier", "verifier_audit_export_api"),
    body: JSON.stringify(manifestPayload("cp_audit_export_manifest_api_001")),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      id: string;
      classification: string;
      entries: Array<{ resourceType: string; redactionPolicy: string }>;
      auditEvent: { entityType: string };
      safety: { hashOnlyManifest: true; rawEvidenceExcluded: true };
    };
  }>(created);
  assert.equal(createdBody.data.id, "cp_audit_export_manifest_api_001");
  assert.equal(createdBody.data.classification, "restricted");
  assert.equal(
    createdBody.data.entries.find((entry) => entry.resourceType === "audit_attestation")?.redactionPolicy,
    "confidential_hash_only",
  );
  assert.equal(createdBody.data.auditEvent.entityType, "audit_export_manifest");
  assert.equal(createdBody.data.safety.hashOnlyManifest, true);
  assert.equal(createdBody.data.safety.rawEvidenceExcluded, true);

  const observerList = await app.request("/canopyproof/audit/export-manifests", {
    headers: headers("observer", "observer_audit_export_list"),
  });
  assert.equal(observerList.status, 200);
  const observerListBody = await json<{ ok: true; data: Array<{ id: string }> }>(observerList);
  assert.equal(observerListBody.data.some((item) => item.id === "cp_audit_export_manifest_api_001"), false);

  const observerDetail = await app.request("/canopyproof/audit/export-manifests/cp_audit_export_manifest_api_001", {
    headers: headers("observer", "observer_audit_export_detail"),
  });
  assert.equal(observerDetail.status, 403);

  const reviewerDetail = await app.request("/canopyproof/audit/export-manifests/cp_audit_export_manifest_api_001", {
    headers: headers("researcher", "researcher_audit_export_detail"),
  });
  assert.equal(reviewerDetail.status, 200);

  const invalidClassification = await app.request("/canopyproof/audit/export-manifests?classification=secret", {
    headers: headers("researcher", "researcher_audit_export_invalid"),
  });
  assert.equal(invalidClassification.status, 400);
});

test("CanopyProof SQL contract stores append-only audit export manifests", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit\.export_manifests/);
  assert.match(sql, /manifest_version text NOT NULL DEFAULT 'canopyproof_audit_export_manifest_v1'/);
  assert.match(sql, /manifest_kind text NOT NULL CHECK \(manifest_kind IN \('institutional_audit_packet', 'public_transparency_packet', 'regulator_review_packet', 'esg_report_packet'\)\)/);
  assert.match(sql, /classification text NOT NULL CHECK \(classification IN \('public', 'internal', 'restricted', 'confidential'\)\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.is_valid_export_manifest_entries/);
  assert.match(sql, /audit_export_manifests_entries_shape/);
  assert.match(sql, /audit_export_manifests_safety_boundary/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.validate_export_manifest_insert/);
  assert.match(sql, /audit export manifest requires an exact semantic event binding/);
  assert.match(sql, /audit_export_manifests_organization_time/);
  assert.match(sql, /audit_export_manifests_no_update/);
  assert.match(sql, /audit_export_manifests_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON audit\.export_manifests/);
});
