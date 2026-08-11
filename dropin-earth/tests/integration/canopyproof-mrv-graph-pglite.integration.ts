import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  CanopyProofMrvGraphAuthorityService,
  canopyProofMrvActorAuthorityRoot,
  canopyProofMrvEndpointHash,
  type CanopyProofMrvActorSnapshot,
  type CanopyProofMrvEndpointSnapshot,
  type CanopyProofMrvMethodologySnapshot,
} from "../../services/api/src/domain/canopyproof/mrv-graph-authority.js";
import { PrismaCanopyProofMrvGraphRepository } from "../../services/api/src/domain/canopyproof/mrv-graph-postgres.js";

const organizationId = "cp_mrv_pglite_org";
const fieldWorkerId = "cp_mrv_pglite_field_worker";
const reviewerId = "cp_mrv_pglite_reviewer";
const projectId = "cp_mrv_pglite_project";
const evidenceId = "cp_mrv_pglite_evidence";
const methodologyId = "cp_mrv_pglite_methodology";
const profileHash = hashJson({ kind: "mrv-pglite-organization-profile" });
const fieldWorkerSubjectHash = hashJson({ kind: "mrv-pglite-subject", id: fieldWorkerId });
const reviewerSubjectHash = hashJson({ kind: "mrv-pglite-subject", id: reviewerId });
const fieldWorkerMembershipRoot = hashJson({ kind: "mrv-pglite-membership", id: fieldWorkerId });
const reviewerMembershipRoot = hashJson({ kind: "mrv-pglite-membership", id: reviewerId });
const accreditationRoot = hashJson({ kind: "mrv-pglite-accreditation" });

test("Digital MRV PostgreSQL authority commits, retries, replays, and rejects source-root substitution", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await loadContracts(db);
    await seedSourceAuthorities(db);
    const repository = new PrismaCanopyProofMrvGraphRepository(pglitePrismaClient(db));
    assert.deepEqual(repository.getStatus(), {
      service: "canopyproof-mrv-graph-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      projectScopedStreams: true,
      serializableWrites: true,
      idempotencyRequired: true,
      sourceRootsReResolved: true,
      snapshotsHumanReviewed: true,
      finalProofAuthority: false,
    });

    const source = await resolvedEndpoint(db, "evidence_object", evidenceId);
    const target = await resolvedEndpoint(db, "project_registration", projectId);
    const methodology = await resolvedMethodology(db);
    const fieldWorker = humanActor(fieldWorkerId, "owner", fieldWorkerSubjectHash, fieldWorkerMembershipRoot);
    const reviewer = humanActor(
      reviewerId,
      "researcher",
      reviewerSubjectHash,
      reviewerMembershipRoot,
      true,
    );
    const service = new CanopyProofMrvGraphAuthorityService();
    const edge = service.recordEdge(
      {
        source: { type: source.type, id: source.id, root: source.root, eventRoot: source.eventRoot },
        relationship: "MEASURES",
        target: { type: target.type, id: target.id, root: target.root, eventRoot: target.eventRoot },
        reasonHash: hashJson({ kind: "mrv-pglite-measurement-reason" }),
        limitationHashes: [],
        createdAt: "2026-07-14T06:01:00.000Z",
      },
      { source, target, methodology, actor: fieldWorker },
    );
    assert.deepEqual(await repository.commitEdge(edge, "mrv-pglite-edge-command-0001"), edge);
    assert.deepEqual(await repository.commitEdge(edge, "mrv-pglite-edge-command-0001"), edge);
    await assert.rejects(
      repository.commitEdge(
        { ...edge, reasonHash: hashJson({ kind: "mrv-pglite-changed-retry" }) },
        "mrv-pglite-edge-command-0001",
      ),
      /CANOPYPROOF_MRV_EDGE_IDEMPOTENCY_CONFLICT/,
    );

    const snapshotBundle = service.recordSnapshot(
      {
        projectId,
        projectRoot: target.root,
        methodologyId,
        methodologyPublicationRoot: methodology.publicationRoot,
        edgeIds: [edge.id],
        conflictDisclosureHash: hashJson({ kind: "mrv-pglite-conflict-disclosure" }),
        limitationHashes: [],
        reviewedAt: "2026-07-14T06:02:00.000Z",
      },
      { reviewer, organizationId, projectId, projectRoot: target.root, methodology },
    );
    assert.equal(snapshotBundle.snapshot.state, "review_required");
    assert.deepEqual(
      await repository.commitSnapshot(
        snapshotBundle.snapshot,
        snapshotBundle.members,
        "mrv-pglite-snapshot-command-0001",
      ),
      snapshotBundle,
    );
    assert.deepEqual(
      await repository.commitSnapshot(
        snapshotBundle.snapshot,
        snapshotBundle.members,
        "mrv-pglite-snapshot-command-0001",
      ),
      snapshotBundle,
    );

    const restartedSnapshot = await repository.loadAuthoritySnapshot(organizationId, projectId);
    const restarted = CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(restartedSnapshot);
    assert.deepEqual(restarted.getEdge(edge.id), edge);
    assert.deepEqual(restarted.getSnapshot(snapshotBundle.snapshot.id), snapshotBundle);
    assert.equal((await repository.projectGraph(organizationId, projectId)).finalProofChanged, false);

    const substitutedSourceSeed = { ...source, root: hashJson({ kind: "mrv-pglite-substituted-source-root" }) };
    const substitutedSource = {
      ...substitutedSourceSeed,
      endpointHash: canopyProofMrvEndpointHash({
        type: substitutedSourceSeed.type,
        id: substitutedSourceSeed.id,
        root: substitutedSourceSeed.root,
        eventRoot: substitutedSourceSeed.eventRoot,
        organizationId: substitutedSourceSeed.organizationId,
        projectId: substitutedSourceSeed.projectId,
        occurredAt: substitutedSourceSeed.occurredAt,
        state: substitutedSourceSeed.state,
        actorIds: substitutedSourceSeed.actorIds,
      }),
    };
    const afterRestart = CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(restartedSnapshot);
    const maliciousEdge = afterRestart.recordEdge(
      {
        source: {
          type: substitutedSource.type,
          id: substitutedSource.id,
          root: substitutedSource.root,
          eventRoot: substitutedSource.eventRoot,
        },
        relationship: "MEASURES",
        target: { type: target.type, id: target.id, root: target.root, eventRoot: target.eventRoot },
        reasonHash: hashJson({ kind: "mrv-pglite-substitution-attempt" }),
        limitationHashes: [],
        createdAt: "2026-07-14T06:03:00.000Z",
      },
      { source: substitutedSource, target, methodology, actor: fieldWorker },
    );
    await assert.rejects(
      repository.commitEdge(maliciousEdge, "mrv-pglite-edge-command-substitution"),
      /CANOPYPROOF_MRV_EDGE_AUTHORITY_INVALID/,
    );

    const counts = await db.query<{
      edge_count: number;
      snapshot_count: number;
      member_count: number;
      event_count: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM mrv.graph_edge_facts) AS edge_count,
        (SELECT count(*)::integer FROM mrv.graph_snapshot_facts) AS snapshot_count,
        (SELECT count(*)::integer FROM mrv.graph_snapshot_member_facts) AS member_count,
        (SELECT count(*)::integer FROM audit.domain_events WHERE stream_id = $1) AS event_count
    `, [`mrv-project:${projectId}`]);
    assert.deepEqual(counts.rows[0], { edge_count: 1, snapshot_count: 1, member_count: 1, event_count: 2 });

    await db.transaction(async (transaction) => {
      await transaction.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await transaction.query("SELECT set_config('app.actor_id', $1, true)", [fieldWorkerId]);
      await assert.rejects(
        transaction.query("UPDATE mrv.graph_edge_facts SET edge_state = 'review_required' WHERE id = $1", [edge.id]),
        /CANOPYPROOF_MRV_APPEND_ONLY_VIOLATION/,
      );
    });
    const policyRows = await db.query<{ policy_count: number; forced_count: number }>(`
      SELECT
        (SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'mrv') AS policy_count,
        (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'mrv' AND c.relforcerowsecurity) AS forced_count
    `);
    assert.deepEqual(policyRows.rows[0], { policy_count: 3, forced_count: 3 });
    await assert.rejects(
      db.exec(await readFile(join(process.cwd(), "services/api/prisma/mrv-graph.rollback.sql"), "utf8")),
      /CANOPYPROOF_MRV_ROLLBACK_REQUIRES_EMPTY_AUTHORITY/,
    );
  } finally {
    await db.close();
  }
});

async function loadContracts(db: PGlite) {
  for (const file of [
    "canopyproof-os.sql",
    "mrv-graph.sql",
  ]) {
    await db.exec(await readFile(join(process.cwd(), "services/api/prisma", file), "utf8"));
  }
  await db.exec(await readFile(join(process.cwd(), "services/api/prisma/mrv-graph.sql"), "utf8"));
}

async function seedSourceAuthorities(db: PGlite) {
  const projectRoot = hashJson({ kind: "mrv-pglite-project-root" });
  const projectEventRoot = hashJson({ kind: "mrv-pglite-project-event-root" });
  const evidenceRoot = hashJson({ kind: "mrv-pglite-evidence-root" });
  const evidenceEventRoot = hashJson({ kind: "mrv-pglite-evidence-event-root" });
  const methodologyHash = hashJson({ kind: "mrv-pglite-methodology-hash" });
  const publicationRoot = hashJson({ kind: "mrv-pglite-methodology-publication-root" });
  await db.exec("SET session_replication_role = replica");
  try {
    await db.query(`
      INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, verification_status,
        trust_level, accreditation_status, profile_hash
      ) VALUES ($1, $2, 'ngo', $2, 'HK', 'verified', 'institutional', 'approved', $3)
    `, [organizationId, "MRV PGlite Organization", profileHash]);
    await db.query(`
      INSERT INTO identity.participants (
        id, participant_type, display_name, organization_id, roles,
        verification_status, subject_hash, created_at, updated_at
      ) VALUES
        ($1, 'human', 'MRV Field Worker', $3, ARRAY['owner']::text[], 'verified', $4, $6, $6),
        ($2, 'human', 'MRV Reviewer', $3, ARRAY['researcher']::text[], 'verified', $5, $6, $6)
    `, [
      fieldWorkerId,
      reviewerId,
      organizationId,
      fieldWorkerSubjectHash,
      reviewerSubjectHash,
      "2026-07-14T05:00:00.000Z",
    ]);
    await db.query(`
      INSERT INTO organizations.memberships (
        id, organization_id, actor_id, role, status, conflict_disclosure,
        granted_by, granted_at, updated_at, audit_event_root
      ) VALUES
        ($1, $3, $4, 'owner', 'active', 'No conflict declared.', $4, $8, $8, $6),
        ($2, $3, $5, 'researcher', 'active', 'No conflict declared.', $4, $8, $8, $7)
    `, [
      `cp_mrv_membership_${fieldWorkerId}`,
      `cp_mrv_membership_${reviewerId}`,
      organizationId,
      fieldWorkerId,
      reviewerId,
      fieldWorkerMembershipRoot,
      reviewerMembershipRoot,
      "2026-07-14T05:01:00.000Z",
    ]);
    await db.query(`
      INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES ($1, $2, 'approved', ARRAY['mrv_graph_review']::text[], $3, $4,
        'Independent MRV graph review authority for integration testing.', $5, $6)
    `, [
      "cp_mrv_pglite_accreditation",
      organizationId,
      fieldWorkerId,
      "2026-07-14T05:02:00.000Z",
      hashJson({ kind: "mrv-pglite-accreditation-evidence" }),
      accreditationRoot,
    ]);
    await db.query(`
      INSERT INTO projects.projects (
        id, organization_id, region_id, title, project_type, status, location,
        created_by, created_by_role, created_at, updated_at, project_hash,
        project_root, audit_event_root, audit_history, claim_boundary
      ) VALUES ($1, $2, 'cp-mrv-region', 'MRV Test Project', 'reforestation', 'submitted', '{}'::jsonb,
        $3, 'owner', $4, $4, $5, $6, $7, '[]'::jsonb, '{}'::jsonb)
    `, [
      projectId,
      organizationId,
      fieldWorkerId,
      "2026-07-14T05:10:00.000Z",
      hashJson({ kind: "mrv-pglite-project-hash" }),
      projectRoot,
      projectEventRoot,
    ]);
    await db.query(`
      INSERT INTO evidence.evidence_objects (
        id, project_id, organization_id, project_root_at_submission,
        project_status_at_submission, project_region_id_at_submission,
        project_authority_updated_at_at_submission, evidence_type, location,
        observed_at, contributor_id, contributor_role, media_hash, gps_hash,
        verification_status, created_at, evidence_hash, evidence_root,
        audit_event_root, audit_history, claim_boundary
      ) VALUES ($1, $2, $3, $4, 'submitted', 'cp-mrv-region', $5,
        'tree_planting', '{}'::jsonb, $6, $7, 'owner', $8, $9,
        'validated', $10, $11, $12, $13, '[]'::jsonb, '{}'::jsonb)
    `, [
      evidenceId,
      projectId,
      organizationId,
      projectRoot,
      "2026-07-14T05:10:00.000Z",
      "2026-07-14T05:20:00.000Z",
      fieldWorkerId,
      hashJson({ kind: "mrv-pglite-media-hash" }),
      hashJson({ kind: "mrv-pglite-gps-hash" }),
      "2026-07-14T05:30:00.000Z",
      hashJson({ kind: "mrv-pglite-evidence-hash" }),
      evidenceRoot,
      evidenceEventRoot,
    ]);
    await db.query(`
      INSERT INTO governance.methodologies (
        id, slug, version, title, scope, status, summary, required_data_sources,
        quality_gates, minimum_gps_accuracy_meters, monitoring_cadence_days,
        evidence_retention_days, governance_approval_ids, limitations, claim_boundary,
        quality_gate_root, methodology_hash, created_by, created_at, published_at, event_root
      ) VALUES ($1, 'mrv-pglite', 'v1.0.0', 'MRV PGlite Methodology', 'tree_planting',
        'published', 'Bounded integration methodology.', ARRAY['field_evidence']::text[],
        ARRAY['human_review']::text[], 25, 90, 3650, ARRAY['approval-a','approval-b']::text[],
        ARRAY['Integration fixture only.']::text[], '{}'::jsonb, $2, $3, $4, $5, $6, $7)
    `, [
      methodologyId,
      hashJson({ kind: "mrv-pglite-quality-gate-root" }),
      methodologyHash,
      fieldWorkerId,
      "2026-07-14T05:00:00.000Z",
      "2026-07-14T05:40:00.000Z",
      hashJson({ kind: "mrv-pglite-methodology-event-root" }),
    ]);
    await db.query(`
      INSERT INTO governance.proof_policy_versions (
        id, subject, governance_organization_id, title, required_approvals,
        allowed_reviewer_roles, creator_id, creator_snapshot, created_at,
        command_hash, policy_hash, policy_root, safety, audit_event_root
      ) VALUES ($1, 'methodology_publication', $2, 'MRV Methodology Publication Policy', 2,
        ARRAY['verifier','researcher']::text[], $3, '{}'::jsonb, $4, $5, $6, $7, '{}'::jsonb, $8)
    `, [
      "cp_mrv_pglite_policy",
      organizationId,
      fieldWorkerId,
      "2026-07-14T05:00:00.000Z",
      hashJson({ kind: "mrv-pglite-policy-command" }),
      hashJson({ kind: "mrv-pglite-policy-hash" }),
      hashJson({ kind: "mrv-pglite-policy-root" }),
      hashJson({ kind: "mrv-pglite-policy-event-root" }),
    ]);
    await db.query(`
      INSERT INTO governance.methodology_publications (
        id, methodology_id, methodology_hash, methodology_quality_gate_root,
        methodology_event_root, policy_id, policy_root, governance_organization_id,
        approval_ids, approval_roots, approval_quorum_root, publisher_id,
        publisher_snapshot, rationale, limitations, source_event_roots, source_root,
        published_at, command_hash, methodology_sequence, previous_event_root,
        publication_hash, publication_root, safety, audit_event_root
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
        ARRAY['approval-a','approval-b']::text[], ARRAY[$9,$10]::text[], $11, $12,
        '{}'::jsonb, 'Published by an independent integration governance fixture.',
        ARRAY[]::text[], ARRAY[$5]::text[], $13, $14, $15, 3, $16, $17, $18, '{}'::jsonb, $19)
    `, [
      "cp_mrv_pglite_publication",
      methodologyId,
      methodologyHash,
      hashJson({ kind: "mrv-pglite-quality-gate-root" }),
      hashJson({ kind: "mrv-pglite-methodology-event-root" }),
      "cp_mrv_pglite_policy",
      hashJson({ kind: "mrv-pglite-policy-root" }),
      organizationId,
      hashJson({ kind: "mrv-pglite-approval-root-a" }),
      hashJson({ kind: "mrv-pglite-approval-root-b" }),
      hashJson({ kind: "mrv-pglite-approval-quorum-root" }),
      fieldWorkerId,
      hashJson({ kind: "mrv-pglite-publication-source-root" }),
      "2026-07-14T05:40:00.000Z",
      hashJson({ kind: "mrv-pglite-publication-command" }),
      hashJson({ kind: "mrv-pglite-publication-previous-event" }),
      hashJson({ kind: "mrv-pglite-publication-hash" }),
      publicationRoot,
      hashJson({ kind: "mrv-pglite-publication-event-root" }),
    ]);
  } finally {
    await db.exec("SET session_replication_role = origin");
  }
}

async function resolvedEndpoint(db: PGlite, type: string, id: string) {
  const result = await db.query<{ endpoint: CanopyProofMrvEndpointSnapshot }>(
    "SELECT mrv.resolve_endpoint($1, $2) AS endpoint",
    [type, id],
  );
  return result.rows[0]!.endpoint;
}

async function resolvedMethodology(db: PGlite) {
  const result = await db.query<{ methodology: CanopyProofMrvMethodologySnapshot }>(
    "SELECT mrv.resolve_methodology($1) AS methodology",
    [methodologyId],
  );
  return result.rows[0]!.methodology;
}

function humanActor(
  id: string,
  role: "owner" | "researcher",
  participantRoot: string,
  membershipRoot: string,
  accredited = false,
): CanopyProofMrvActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot,
    organizationRoot: profileHash,
    membershipId: `cp_mrv_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot,
    ...(accredited
      ? {
          accreditationId: "cp_mrv_pglite_accreditation",
          accreditationStatus: "approved" as const,
          accreditationRoot,
          accreditationScope: ["mrv_graph_review"],
        }
      : { accreditationScope: [] }),
  };
  return { ...seed, authorityRoot: canopyProofMrvActorAuthorityRoot(seed) };
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
