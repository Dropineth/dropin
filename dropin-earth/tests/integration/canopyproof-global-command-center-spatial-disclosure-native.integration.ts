import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofGlobalCommandCenterSpatialCandidate,
  buildCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  buildCanopyProofGlobalCommandCenterSpatialReview,
  canopyProofGlobalCommandCenterSpatialDisclosureScopes,
} from "../../services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-authority.js";
import { PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository } from "../../services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-postgres.js";

const nativeDatabaseUrlEnvironment = "CANOPYPROOF_NATIVE_DATABASE_URL";
const nativeDatabaseConfirmationEnvironment = "CANOPYPROOF_NATIVE_TEST_CONFIRM";
const nativeDatabaseConfirmation = "confirm-disposable-test-database";

test(
  "Global spatial disclosure enforces forced RLS with a native non-bypass PostgreSQL role",
  { timeout: 180_000 },
  async () => {
    const databaseUrl = requireDisposableNativeDatabase();
    applyContract(databaseUrl);
    const runId = randomUUID().replaceAll("-", "");
    const organizationId = `cp_native_spatial_org_${runId}`;
    const otherOrganizationId = `cp_native_spatial_other_${runId}`;
    const regionId = `cp_native_spatial_region_${runId}`;
    const regionSourceRoot = hashJson({ kind: "native-spatial-region-source", runId });
    const scopes = Object.values(canopyProofGlobalCommandCenterSpatialDisclosureScopes).sort();
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const reconnect = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const roleName = `canopyproof_spatial_rls_${runId}`;
    try {
      await client.$connect();
      await seedAuthority(client, { organizationId, runId, scopes });
      const privacyReviewer = actor("privacy", "verifier", { organizationId, runId, scopes });
      const safeguardingReviewer = actor("safeguarding", "verifier", { organizationId, runId, scopes });
      const publisher = actor("publisher", "admin", { organizationId, runId, scopes });
      const candidate = buildCanopyProofGlobalCommandCenterSpatialCandidate({
        schemaVersion: "canopyproof.global-command-center.spatial-disclosure.v1",
        organizationId,
        regionId,
        centroid: { latitudeDegrees: 15, longitudeDegrees: -17 },
        precisionDegrees: 1,
        sourceProjectCount: 3,
        minimumCohortSize: 3,
        regionSourceRoot,
        policyId: `cp_native_spatial_policy_${runId}`,
        policyRoot: hashJson({ kind: "native-spatial-policy", runId }),
        validFrom: "2026-07-19T12:00:00.000Z",
        validUntil: "2026-07-20T12:00:00.000Z",
      });
      const privacyReview = buildCanopyProofGlobalCommandCenterSpatialReview(
        {
          candidate,
          reviewKind: "privacy",
          decision: "approved",
          reviewedAt: "2026-07-19T12:00:00.000Z",
          rationale: "Native PostgreSQL privacy review approved only the minimized one-degree centroid.",
        },
        privacyReviewer,
      );
      const safeguardingReview = buildCanopyProofGlobalCommandCenterSpatialReview(
        {
          candidate,
          reviewKind: "safeguarding",
          decision: "approved",
          reviewedAt: "2026-07-19T12:01:00.000Z",
          rationale: "Native PostgreSQL safeguarding review approved the exact minimized candidate.",
        },
        safeguardingReviewer,
      );
      const disclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        {
          candidate,
          privacyReview,
          safeguardingReview,
          publishedAt: "2026-07-19T12:02:00.000Z",
        },
        publisher,
      );
      const repository = new PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository(client);
      await repository.commitReview(privacyReview, `native-spatial-privacy-${runId}`, async () => ({
        candidate,
        reviewer: privacyReviewer,
      }));
      await repository.commitReview(
        safeguardingReview,
        `native-spatial-safeguarding-${runId}`,
        async () => ({ candidate, reviewer: safeguardingReviewer }),
      );
      await repository.commitDisclosure(disclosure, `native-spatial-publication-${runId}`, async () => ({
        candidate,
        publisher,
        privacyReviewer,
        safeguardingReviewer,
      }));

      await client.$executeRaw(Prisma.raw(`CREATE ROLE ${roleName} NOLOGIN`));
      await client.$executeRaw(Prisma.raw(`GRANT USAGE ON SCHEMA impact TO ${roleName}`));
      await client.$executeRaw(
        Prisma.raw(`GRANT SELECT ON impact.global_command_center_spatial_review_facts,
          impact.global_command_center_spatial_disclosure_facts,
          impact.global_command_center_spatial_control_facts TO ${roleName}`),
      );
      await client.$transaction(async (transaction) => {
        await transaction.$executeRaw(Prisma.raw(`SET LOCAL ROLE ${roleName}`));
        await transaction.$queryRaw(Prisma.sql`
          SELECT set_config('app.organization_id', ${organizationId}, true)
        `);
        const own = await transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM impact.global_command_center_spatial_disclosure_facts
          WHERE id = ${disclosure.id}
        `);
        assert.equal(Number(own[0]?.count ?? -1n), 1);
        await transaction.$queryRaw(Prisma.sql`
          SELECT set_config('app.organization_id', ${otherOrganizationId}, true)
        `);
        const other = await transaction.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM impact.global_command_center_spatial_disclosure_facts
          WHERE id = ${disclosure.id}
        `);
        assert.equal(Number(other[0]?.count ?? -1n), 0);
      });

      await assert.rejects(
        client.$transaction(async (transaction) => {
          await transaction.$queryRaw(Prisma.sql`
            SELECT set_config('app.organization_id', ${organizationId}, true)
          `);
          await transaction.$queryRaw(Prisma.sql`
            SELECT set_config('app.actor_id', ${publisher.id}, true)
          `);
          await transaction.$executeRaw(Prisma.sql`
            UPDATE impact.global_command_center_spatial_disclosure_facts
            SET published_at = published_at
            WHERE id = ${disclosure.id}
          `);
        }),
        /audit records are append-only/i,
      );

      await reconnect.$connect();
      const restarted = new PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository(reconnect);
      assert.deepEqual(
        await restarted.resolveCurrentDisclosure({
          organizationId,
          actorId: publisher.id,
          regionId,
          regionSourceRoot,
          sourceProjectCount: 3,
          at: "2026-07-19T12:03:00.000Z",
        }),
        disclosure.disclosure,
      );
    } finally {
      await Promise.allSettled([client.$disconnect(), reconnect.$disconnect()]);
    }
  },
);

function actor(
  suffix: string,
  role: "admin" | "verifier",
  input: Readonly<{ organizationId: string; runId: string; scopes: readonly string[] }>,
): CanopyProofVerificationActorSnapshot {
  const id = `cp_native_spatial_${suffix}_${input.runId}`;
  const participantRoot = hashJson({ kind: "native-spatial-participant", id });
  const organizationRoot = hashJson({ kind: "native-spatial-organization", organizationId: input.organizationId });
  const membershipRoot = hashJson({ kind: "native-spatial-membership", id, role });
  const accreditationRoot = hashJson({
    kind: "native-spatial-accreditation",
    organizationId: input.organizationId,
    scopes: input.scopes,
  });
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId: input.organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot,
    organizationRoot,
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot,
    accreditationId: `accreditation_native_spatial_${input.runId}`,
    accreditationStatus: "approved" as const,
    accreditationRoot,
    accreditationScope: input.scopes,
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

async function seedAuthority(
  client: PrismaClient,
  input: Readonly<{ organizationId: string; runId: string; scopes: readonly string[] }>,
) {
  const actors = [
    actor("privacy", "verifier", input),
    actor("safeguarding", "verifier", input),
    actor("publisher", "admin", input),
  ];
  await client.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`
      SELECT set_config('app.actor_id', ${actors[2]!.id}, true)
    `);
    for (const actorSnapshot of actors) {
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO identity.participants (
          id, participant_type, display_name, organization_id, roles,
          verification_status, reputation_score, credential_commitments,
          subject_hash, created_at, updated_at
        ) VALUES (
          ${actorSnapshot.id}, 'human', ${`Native spatial ${actorSnapshot.role}`},
          ${input.organizationId}, ARRAY[${actorSnapshot.role}]::text[], 'verified', 80,
          ARRAY[]::text[], ${actorSnapshot.participantRoot},
          '2026-07-19T11:00:00.000Z', '2026-07-19T11:00:00.000Z'
        )
      `);
    }
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organizations (
        id, name, organization_type, legal_name, jurisdiction, operating_regions,
        verification_capabilities, verification_status, trust_level,
        accreditation_status, data_sharing_policy, profile_hash, created_at, updated_at
      ) VALUES (
        ${input.organizationId}, 'Native Spatial Authority', 'auditor',
        'Native Spatial Authority', 'GLOBAL', ARRAY['global']::text[],
        ARRAY['spatial_review']::text[], 'verified', 'institutional', 'approved',
        'restricted', ${actors[0]!.organizationRoot},
        '2026-07-19T11:00:00.000Z', '2026-07-19T11:00:00.000Z'
      )
    `);
    for (const actorSnapshot of actors) {
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO organizations.memberships (
          id, organization_id, actor_id, role, status, conflict_disclosure,
          granted_by, granted_at, updated_at, audit_event_root
        ) VALUES (
          ${actorSnapshot.membershipId!}, ${input.organizationId}, ${actorSnapshot.id},
          ${actorSnapshot.role}, 'active', 'No conflict in disposable native fixture.',
          ${actors[2]!.id}, '2026-07-19T11:00:00.000Z',
          '2026-07-19T11:00:00.000Z', ${actorSnapshot.membershipRoot!}
        )
      `);
    }
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.accreditations (
        id, organization_id, status, scope, decided_by, decided_at,
        rationale, evidence_hash, audit_event_root
      ) VALUES (
        ${actors[0]!.accreditationId!}, ${input.organizationId}, 'approved',
        ${input.scopes}::text[], ${actors[2]!.id}, '2026-07-19T11:00:00.000Z',
        'Disposable native spatial authority accreditation.',
        ${hashJson({ kind: "native-spatial-accreditation-evidence", runId: input.runId })},
        ${actors[0]!.accreditationRoot!}
      )
    `);
  });
}

function applyContract(databaseUrl: string) {
  const prismaBinary = join(process.cwd(), "node_modules", ".bin", "prisma");
  for (const contract of [
    "canopyproof-os.sql",
    "global-command-center-spatial-disclosure-authority.sql",
  ]) {
    execFileSync(
      prismaBinary,
      [
        "db",
        "execute",
        "--file",
        join(process.cwd(), "services", "api", "prisma", contract),
        "--schema",
        join(process.cwd(), "services", "api", "prisma", "schema.prisma"),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "ignore",
      },
    );
  }
}

function requireDisposableNativeDatabase() {
  const value = process.env[nativeDatabaseUrlEnvironment]?.trim();
  if (!value) throw new Error(`${nativeDatabaseUrlEnvironment} is required for the opt-in native PostgreSQL gate.`);
  if (process.env[nativeDatabaseConfirmationEnvironment] !== nativeDatabaseConfirmation) {
    throw new Error(
      `${nativeDatabaseConfirmationEnvironment} must equal ${nativeDatabaseConfirmation} before the native gate can write.`,
    );
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${nativeDatabaseUrlEnvironment} must use postgresql:// or postgres://.`);
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(?:^|[_-])(?:test|ci)(?:$|[_-])/i.test(databaseName)) {
    throw new Error("Native spatial validation requires a database name explicitly marked test or ci.");
  }
  return value;
}
