import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofVisualEvidenceAuthorityService,
  createVisualHumanReviewer,
  createVisualServiceActor,
  visualAuthorityRecords,
} from "../../services/api/src/domain/canopyproof/visual-evidence-intelligence.js";
import { createVineLidarLabLicensePolicy } from "../../services/api/src/domain/canopyproof/visual-license-policy.js";
import {
  CanopyProofTrustRegistryError,
  PrismaCanopyProofTrustRegistryService,
} from "../../services/api/src/domain/canopyproof/trust-registry.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";

const tenantId = "cp_visual_sql_tenant";
const organizationId = "cp_visual_sql_org";
const agentId = "cp_visual_sql_agent";
const reviewerId = "cp_visual_sql_reviewer";
const accreditationId = "cp_visual_sql_accreditation";
const accreditationRoot = hashJson({ kind: "canopyproof-visual-sql-accreditation-v1" });
const scope = { tenantId, organizationId } as const;

test("visual authority persists through the canonical Trust Kernel transaction and audit stream", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const trustKernel = await readFile(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  const visualMigration = await readFile(
    join(process.cwd(), "services/api/prisma/visual-evidence-intelligence.sql"),
    "utf8",
  );
  const rollback = await readFile(
    join(process.cwd(), "services/api/prisma/visual-evidence-intelligence.rollback.sql"),
    "utf8",
  );

  try {
    await db.exec(trustKernel);
    await seedVisualAgent(db);
    await db.exec(visualMigration);
    await db.exec(visualMigration);

    const domain = visualDatasetAuthority();
    const snapshot = domain.getAuthoritySnapshot();
    const registry = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    const committed = await registry.commitVisualEvidenceAuthoritySnapshot(
      snapshot,
      scope,
      agentId,
      "visual-dataset-command-001",
    );
    assert.deepEqual(committed, snapshot);

    const replayed = await registry.commitVisualEvidenceAuthoritySnapshot(
      snapshot,
      scope,
      agentId,
      "visual-dataset-command-001",
    );
    assert.deepEqual(replayed, snapshot);

    const license = createVineLidarLabLicensePolicy("2026-07-13T17:00:00.000Z");
    const datasetSnapshot = snapshot.datasetSnapshots[0];
    assert.ok(datasetSnapshot);
    const modelActor = visualAgent("visual_model_execution");
    const model = domain.registerModelDefinition(
      {
        tenantId,
        organizationId,
        classification: "INTERNAL",
        licensePolicyId: license.id,
        createdAt: "2026-07-13T17:04:00.000Z",
        name: "Durable visual SQL model",
        modelFamily: "integration-detector",
        artifactHash: hashJson({ kind: "canopyproof-visual-sql-model-v1" }),
        containerDigest: hashJson({ kind: "canopyproof-visual-sql-container-v1" }),
        sbomHash: hashJson({ kind: "canopyproof-visual-sql-sbom-v1" }),
        preprocessingContractHash: hashJson({ kind: "canopyproof-visual-sql-preprocess-v1" }),
        outputSchemaVersion: "visual-candidate-v1",
        domainPolicy: {
          supportedSensors: ["LIDAR"],
          supportedResolutionRange: [100, 140],
          supportedResolutionUnit: "points_per_square_meter",
          supportedAltitudeRange: [20, 40],
          supportedSeasons: ["summer"],
          supportedEcosystems: ["vineyard"],
          supportedGeographies: ["fixture-region"],
          requiresCalibration: true,
          knownLimitations: ["integration fixture only"],
          calibrationDatasetRefs: [datasetSnapshot.id],
        },
      },
      modelActor,
    );
    const sourceDomain = {
      sensor: "LIDAR" as const,
      resolution: 120,
      resolutionUnit: "points_per_square_meter" as const,
      altitudeMeters: 30,
      season: "summer",
      ecosystem: "vineyard",
      geography: "fixture-region",
      calibrationState: "calibrated" as const,
    };
    const modelRun = domain.recordModelRun(
      {
        modelDefinitionId: model.id,
        datasetSnapshotId: datasetSnapshot.id,
        sourceDomain,
        canonicalParametersHash: hashJson({ threshold: 0.6 }),
        deterministicSeed: "durable-visual-seed-001",
        runtimeDigest: hashJson({ kind: "canopyproof-visual-sql-runtime-v1" }),
        startedAt: "2026-07-13T17:05:00.000Z",
        completedAt: "2026-07-13T17:06:00.000Z",
        outputRoot: hashJson({ kind: "canopyproof-visual-sql-output-v1" }),
        licensePolicy: license,
      },
      modelActor,
    );
    const candidate = domain.recordCandidate(
      {
        modelRunId: modelRun.id,
        sampleId: "cp_visual_sql_sample_1",
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        modelScore: 0.82,
        geometryScore: 0.74,
        noveltyScore: 0.63,
        uncertaintyScore: 0.21,
        sensorDomain: sourceDomain,
        createdAt: "2026-07-13T17:07:00.000Z",
      },
      visualAgent("visual_candidate_import"),
    );
    const machineSnapshot = domain.getAuthoritySnapshot();
    await registry.commitVisualEvidenceAuthoritySnapshot(
      machineSnapshot,
      scope,
      agentId,
      "visual-machine-command-001",
    );

    const queue = domain.createReviewQueue(
      {
        datasetSnapshotId: datasetSnapshot.id,
        candidateIds: [candidate.id],
        sampleIds: [candidate.sampleId],
        purpose: "durable human review",
        methodologyId: "cp_visual_sql_methodology_001",
        requiredReviewerRoles: ["verifier"],
        secondReviewRequired: false,
        fieldCheckPolicy: "ON_REQUEST",
        filterExpression: "candidate.modelScore >= 0.6",
        sortExpression: "candidate.modelScore DESC",
        modelRunIds: [modelRun.id],
        randomQaSeed: "durable-random-qa-seed",
        createdAt: "2026-07-13T17:08:00.000Z",
      },
      visualAgent("visual_manifest_issuance"),
    );
    const queueSnapshot = domain.getAuthoritySnapshot();
    await registry.commitVisualEvidenceAuthoritySnapshot(
      queueSnapshot,
      scope,
      agentId,
      "visual-queue-command-001",
    );
    const queueV2 = domain.createReviewQueue(
      {
        queueId: queue.queue.id,
        datasetSnapshotId: datasetSnapshot.id,
        candidateIds: [candidate.id],
        sampleIds: [candidate.sampleId],
        purpose: "durable human review",
        methodologyId: "cp_visual_sql_methodology_001",
        requiredReviewerRoles: ["verifier"],
        secondReviewRequired: false,
        fieldCheckPolicy: "ON_REQUEST",
        filterExpression: "candidate.modelScore >= 0.7",
        sortExpression: "candidate.modelScore DESC",
        modelRunIds: [modelRun.id],
        randomQaSeed: "durable-random-qa-seed",
        priorQueueSnapshotId: queue.snapshot.id,
        createdAt: "2026-07-13T17:08:30.000Z",
      },
      visualAgent("visual_manifest_issuance"),
    );
    assert.equal(queueV2.createdNewVersion, true);
    assert.equal(queueV2.queue.version, 2);
    await registry.commitVisualEvidenceAuthoritySnapshot(
      domain.getAuthoritySnapshot(),
      scope,
      agentId,
      "visual-queue-command-002",
    );

    const reviewer = createVisualHumanReviewer({
      id: reviewerId,
      tenantId,
      organizationId,
      role: "verifier",
      accreditationId,
      accreditationRoot,
      conflictFree: true,
    });
    domain.recordReviewDecision(
      {
        candidateId: candidate.id,
        reviewQueueSnapshotId: queueV2.snapshot.id,
        decision: "REJECT_FALSE_POSITIVE",
        rationaleCode: "SHADOW_CONFUSER",
        notesHash: hashJson({ kind: "canopyproof-visual-sql-review-note-v1" }),
        reviewerConfidence: 0.94,
        reviewedAt: "2026-07-13T17:09:00.000Z",
      },
      reviewer,
    );
    const finalSnapshot = domain.getAuthoritySnapshot();
    await registry.commitVisualEvidenceAuthoritySnapshot(
      finalSnapshot,
      scope,
      reviewerId,
      "visual-review-command-001",
    );

    const historicalReplay = await registry.commitVisualEvidenceAuthoritySnapshot(
      snapshot,
      scope,
      agentId,
      "visual-dataset-command-001",
    );
    assert.deepEqual(historicalReplay, snapshot);
    const restarted = new PrismaCanopyProofTrustRegistryService(pglitePrismaClient(db));
    assert.deepEqual(await restarted.getVisualEvidenceAuthoritySnapshot(scope), finalSnapshot);

    const recordCount = String(
      (await db.query<{ count: number | bigint }>("SELECT count(*)::bigint AS count FROM visual.authority_facts"))
        .rows[0]?.count,
    );
    const eventCount = String(
      (
        await db.query<{ count: number | bigint }>(
          "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE stream_id LIKE 'visual:%'",
        )
      ).rows[0]?.count,
    );
    const receiptCount = String(
      (
        await db.query<{ count: number | bigint }>(
          "SELECT count(*)::bigint AS count FROM audit.command_receipts WHERE operation = 'visual.authority.snapshot.commit'",
        )
      ).rows[0]?.count,
    );
    assert.equal(recordCount, String(finalSnapshot.auditHistory.length));
    assert.equal(eventCount, String(finalSnapshot.auditHistory.length));
    assert.equal(receiptCount, "5");
    assert.equal(
      String(
        (
          await db.query<{ count: number | bigint }>(
            "SELECT count(*)::bigint AS count FROM audit.event_log WHERE schema_name = 'visual'",
          )
        ).rows[0]?.count,
      ),
      String(finalSnapshot.auditHistory.length + 2),
    );

    const parallelReceipt = await db.query<{ relation: string | null }>(
      "SELECT to_regclass('visual.command_receipts')::text AS relation",
    );
    assert.equal(parallelReceipt.rows[0]?.relation, null);

    const persisted = await db.query<{
      fact_hash: string;
      fact_root: string;
      audit_event_root: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT fact_hash, fact_root, audit_event_root, payload
       FROM visual.authority_facts
       ORDER BY created_at, id`,
    );
    const persistedByRoot = new Map(persisted.rows.map((row) => [row.fact_root, row] as const));
    for (const record of visualAuthorityRecords(finalSnapshot)) {
      const row = persistedByRoot.get(record.factRoot);
      assert.equal(row?.fact_hash, record.factHash);
      assert.equal(row?.audit_event_root, record.auditEvent.eventRoot);
      assert.deepEqual(row?.payload, record);
    }
    assert.equal(
      persisted.rows.every((row) => JSON.stringify(row.payload).includes("modelCandidateNotEvidence")),
      true,
    );

    const persistedCandidate = finalSnapshot.candidates[0];
    assert.ok(persistedCandidate);
    const forgedId = "cp_visual_candidate_forged_actor_root";
    const forgedActorRoot = "f".repeat(64);
    const forgedCreatedAt = "2026-07-13T17:10:00.000Z";
    const forgedSeed = structuredClone(persistedCandidate) as unknown as Record<string, unknown>;
    delete forgedSeed.factHash;
    delete forgedSeed.factRoot;
    delete forgedSeed.auditEvent;
    delete forgedSeed.safety;
    forgedSeed.id = forgedId;
    forgedSeed.actorAuthorityRoot = forgedActorRoot;
    forgedSeed.actorSnapshot = {
      ...persistedCandidate.actorSnapshot,
      authorityRoot: forgedActorRoot,
    };
    forgedSeed.createdAt = forgedCreatedAt;
    const forgedFactHash = hashJson({ kind: "canopyproof-visual-candidate-fact-v1", ...forgedSeed });
    const forgedAuditEvent = appendCanopyProofAuditEvent(finalSnapshot.auditHistory, {
      action: "ASSERT",
      actor: agentId,
      entityType: "visual_candidate",
      entityId: forgedId,
      payload: {
        factHash: forgedFactHash,
        sourceRoots: persistedCandidate.sourceRoots,
        recordType: "visual-candidate",
      },
      createdAt: forgedCreatedAt,
      rationale: "Attempt a canonical visual fact with a forged actor authority root.",
    }).at(-1)!;
    const forgedFactRoot = hashJson({
      kind: "canopyproof-visual-candidate-root-v1",
      factHash: forgedFactHash,
      sourceRoots: persistedCandidate.sourceRoots,
      auditEventRoot: forgedAuditEvent.eventRoot,
    });
    const forgedPayload = {
      ...forgedSeed,
      factHash: forgedFactHash,
      factRoot: forgedFactRoot,
      auditEvent: forgedAuditEvent,
      safety: persistedCandidate.safety,
    };
    const visualStreamId = `visual:${hashJson({
      kind: "canopyproof-visual-authority-stream-v1",
      tenantId,
      organizationId,
      projectId: null,
    })}`;
    await assert.rejects(
      db.transaction(async (transaction) => {
        await transaction.query("SELECT set_config('app.actor_id', $1, true)", [agentId]);
        await transaction.query("SELECT set_config('canopyproof.tenant_id', $1, true)", [tenantId]);
        await transaction.query(
          `INSERT INTO audit.domain_events (
            id, stream_id, action, actor_id, entity_type, entity_id,
            previous_root, payload_hash, event_root, created_at, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            forgedAuditEvent.id,
            visualStreamId,
            forgedAuditEvent.action,
            forgedAuditEvent.actor,
            forgedAuditEvent.entityType,
            forgedAuditEvent.entityId,
            forgedAuditEvent.previousRoot,
            forgedAuditEvent.payloadHash,
            forgedAuditEvent.eventRoot,
            forgedAuditEvent.createdAt,
            forgedAuditEvent.rationale,
          ],
        );
        await transaction.query(
          `INSERT INTO visual.authority_facts (
            entity_type, id, entity_version, stream_sequence,
            tenant_id, organization_id, classification, license_policy_id,
            actor_id, actor_type, actor_authority_root, created_at,
            source_roots, payload, fact_hash, fact_root, prior_fact_root,
            audit_event_id, audit_event_root
          ) VALUES (
            'candidate_finding', $1, 1, 1, $2, $3, 'INTERNAL', $4,
            $5, 'agent', $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14
          )`,
          [
            forgedId,
            tenantId,
            organizationId,
            persistedCandidate.licensePolicyId,
            agentId,
            forgedActorRoot,
            forgedCreatedAt,
            JSON.stringify(persistedCandidate.sourceRoots),
            JSON.stringify(forgedPayload),
            forgedFactHash,
            forgedFactRoot,
            canopyProofAuditGenesisRoot(),
            forgedAuditEvent.id,
            forgedAuditEvent.eventRoot,
          ],
        );
      }),
      /CANOPYPROOF_VISUAL_ACTOR_AUTHORITY_INVALID/,
    );
    assert.equal(
      String(
        (
          await db.query<{ count: number | bigint }>(
            "SELECT count(*)::bigint AS count FROM audit.domain_events WHERE id = $1",
            [forgedAuditEvent.id],
          )
        ).rows[0]?.count,
      ),
      "0",
    );

    const datasetMemberCount = String(
      (
        await db.query<{ count: number | bigint }>(
          "SELECT count(*)::bigint AS count FROM visual.dataset_snapshot_members",
        )
      ).rows[0]?.count,
    );
    assert.equal(datasetMemberCount, "2");
    assert.equal(
      String(
        (await db.query<{ count: number | bigint }>("SELECT count(*)::bigint AS count FROM visual.review_queue_snapshots"))
          .rows[0]?.count,
      ),
      "2",
    );
    assert.equal(
      String(
        (await db.query<{ count: number | bigint }>("SELECT count(*)::bigint AS count FROM visual.review_queue_members"))
          .rows[0]?.count,
      ),
      "2",
    );

    await assert.rejects(
      db.query("UPDATE visual.authority_facts SET payload = payload WHERE id = $1", [snapshot.datasets[0]?.id]),
      /CANOPYPROOF_VISUAL_APPEND_ONLY/,
    );
    await assert.rejects(db.exec(rollback), /CANOPYPROOF_VISUAL_ROLLBACK_BLOCKED/);
    await db.exec("ROLLBACK");

    const unsafeDomain = visualDatasetAuthority("service", "cp_visual_sql_other_tenant");
    await assert.rejects(
      registry.commitVisualEvidenceAuthoritySnapshot(
        unsafeDomain.getAuthoritySnapshot(),
        { tenantId: "cp_visual_sql_other_tenant", organizationId },
        agentId,
        "visual-service-identity-denied-001",
      ),
      /registered human or agent|command actor/i,
    );
    assert.equal(
      String(
        (
          await db.query<{ count: number | bigint }>(
            "SELECT count(*)::bigint AS count FROM audit.command_receipts WHERE operation = 'visual.authority.snapshot.commit'",
          )
        ).rows[0]?.count,
      ),
      "5",
    );

    await assert.rejects(
      registry.commitVisualEvidenceAuthoritySnapshot(
        finalSnapshot,
        scope,
        agentId,
        "visual-dataset-command-002",
      ),
      (error: unknown) =>
        error instanceof CanopyProofTrustRegistryError &&
        error.code === "CANOPYPROOF_TRUST_REGISTRY_CONFLICT",
    );
  } finally {
    await db.close();
  }
});

function visualDatasetAuthority(
  actorType: "agent" | "service" = "agent",
  actorTenantId = tenantId,
) {
  const authority = new CanopyProofVisualEvidenceAuthorityService();
  const license = createVineLidarLabLicensePolicy("2026-07-13T17:00:00.000Z");
  const actor = createVisualServiceActor({
    id: agentId,
    actorType,
    tenantId: actorTenantId,
    organizationId,
    capability: "visual_dataset_registration",
  });
  const mission = authority.registerAcquisitionMission(
    {
      tenantId: actorTenantId,
      organizationId,
      classification: "INTERNAL",
      licensePolicyId: license.id,
      missionName: "Durable visual integration mission",
      platformType: "fixed_test_fixture",
      purpose: "trust-kernel persistence validation",
      startedAt: "2026-07-13T17:01:00.000Z",
      completedAt: "2026-07-13T17:01:30.000Z",
      geometryRef: "cp_generalized_visual_geometry_001",
      permitRoots: [hashJson({ kind: "canopyproof-visual-permit-fixture-v1" })],
    },
    actor,
  );
  const stream = authority.registerSensorStream(
    {
      tenantId: actorTenantId,
      organizationId,
      classification: "INTERNAL",
      licensePolicyId: license.id,
      createdAt: "2026-07-13T17:02:00.000Z",
      acquisitionMissionId: mission.id,
      modality: "LIDAR",
      make: "Fixture",
      model: "Durable LiDAR v1",
      serialCommitment: hashJson({ kind: "canopyproof-visual-sensor-fixture-v1" }),
      nativeResolution: 120,
      resolutionUnit: "points_per_square_meter",
      altitudeRangeMeters: [20, 40],
      calibrationRecordId: "cp_visual_calibration_fixture_001",
      calibrationState: "calibrated",
      clockQuality: "verified",
      coordinateFrame: "ABSOLUTE_CRS",
      knownLimitations: ["integration fixture only"],
    },
    actor,
  );
  authority.registerDataset(
    {
      datasetName: "Durable visual integration dataset",
      purpose: "LAB_BENCHMARK",
      tenantId: actorTenantId,
      organizationId,
      classification: "INTERNAL",
      pairingPolicyVersion: "visual-pairing-v1",
      sensorStreamIds: [stream.id],
      members: [
        datasetMember(stream.id, license.id, 1),
        datasetMember(stream.id, license.id, 2),
      ],
      pairingEdgeRoots: [],
      createdAt: "2026-07-13T17:03:00.000Z",
      licensePolicy: license,
    },
    actor,
  );
  return authority;
}

function visualAgent(capability: Parameters<typeof createVisualServiceActor>[0]["capability"]) {
  return createVisualServiceActor({
    id: agentId,
    actorType: "agent",
    tenantId,
    organizationId,
    capability,
  });
}

function datasetMember(sensorStreamId: string, licensePolicyId: string, ordinal: number) {
  return {
    sampleId: `cp_visual_sql_sample_${ordinal}`,
    assetId: `cp_visual_sql_asset_${ordinal}`,
    assetVersion: 1,
    assetRoot: hashJson({ kind: "canopyproof-visual-asset-fixture-v1", ordinal }),
    contentHash: hashJson({ kind: "canopyproof-visual-content-fixture-v1", ordinal }),
    sensorStreamId,
    pairedSampleIds: [],
    licensePolicyId,
  } as const;
}

async function seedVisualAgent(db: PGlite) {
  await db.transaction(async (transaction) => {
    await transaction.query("SELECT set_config('app.actor_id', $1, true)", [agentId]);
    await transaction.query(
      `INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction,
        verification_status, trust_level, accreditation_status,
        data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES (
        $1, 'Visual SQL Institute', 'research_institution', 'Visual SQL Institute', 'GLOBAL',
        'verified', 'institutional', 'approved', 'restricted', $2,
        '2026-07-13T16:55:00.000Z', '2026-07-13T16:55:00.000Z'
      )`,
      [organizationId, hashJson({ kind: "canopyproof-visual-sql-org-v1" })],
    );
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, organization_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES (
        $1, 'agent', 'Visual SQL Agent', $2, ARRAY['observer']::text[],
        'verified', 100, ARRAY[]::text[], $3,
        '2026-07-13T16:56:00.000Z', '2026-07-13T16:56:00.000Z'
      )`,
      [agentId, organizationId, hashJson({ kind: "canopyproof-visual-sql-agent-v1" })],
    );
    await transaction.query(
      `INSERT INTO identity.agent_profiles (
        id, agent_type, layer, capabilities, allowed_actions,
        human_review_required, final_authority, status, registry_hash
      ) VALUES (
        $1, 'evidence', 'Evidence',
        ARRAY['visual_dataset_registration', 'visual_model_execution', 'visual_candidate_import',
          'visual_manifest_issuance', 'visual_field_task_assignment']::text[],
        ARRAY['append_visual_fact']::text[], true, false, 'active', $2
      )`,
      [agentId, hashJson({ kind: "canopyproof-visual-sql-agent-profile-v1" })],
    );
    await transaction.query(
      `INSERT INTO identity.participants (
        id, participant_type, display_name, organization_id, roles,
        verification_status, reputation_score, credential_commitments,
        subject_hash, created_at, updated_at
      ) VALUES (
        $1, 'human', 'Visual SQL Reviewer', $2, ARRAY['verifier']::text[],
        'verified', 100, ARRAY[]::text[], $3,
        '2026-07-13T16:57:00.000Z', '2026-07-13T16:57:00.000Z'
      )`,
      [reviewerId, organizationId, hashJson({ kind: "canopyproof-visual-sql-reviewer-v1" })],
    );
    await transaction.query(
      `INSERT INTO organizations.memberships (
        id, organization_id, actor_id, role, status, conflict_disclosure,
        granted_by, granted_at, updated_at, audit_event_root
      ) VALUES (
        'cp_visual_sql_reviewer_membership', $1, $2, 'verifier', 'active',
        'Reviewer is independent from acquisition and model execution.', $3,
        '2026-07-13T16:58:00.000Z', '2026-07-13T16:58:00.000Z', $4
      )`,
      [
        organizationId,
        reviewerId,
        agentId,
        hashJson({ kind: "canopyproof-visual-sql-reviewer-membership-v1" }),
      ],
    );
    await transaction.query(
      `INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES (
        $1, $2, 'approved', ARRAY['visual_evidence_review']::text[], $3,
        '2026-07-13T16:59:00.000Z',
        'Independent visual evidence review authority for integration validation.', $4, $5
      )`,
      [
        accreditationId,
        organizationId,
        agentId,
        hashJson({ kind: "canopyproof-visual-sql-accreditation-evidence-v1" }),
        accreditationRoot,
      ],
    );
  });
}

function pglitePrismaClient(db: PGlite) {
  const client = {
    async $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
      return db.transaction((transaction) => operation(pgliteTransactionClient(transaction)));
    },
  };
  return client as unknown as PrismaClient;
}

function pgliteTransactionClient(transaction: Transaction) {
  return {
    async $queryRaw<T = unknown[]>(query: Prisma.Sql): Promise<T> {
      const result = await transaction.query(query.text, query.values);
      return result.rows as T;
    },
    async $executeRaw(query: Prisma.Sql) {
      const result = await transaction.query(query.text, query.values);
      return result.affectedRows ?? 0;
    },
  } as unknown as Prisma.TransactionClient;
}
