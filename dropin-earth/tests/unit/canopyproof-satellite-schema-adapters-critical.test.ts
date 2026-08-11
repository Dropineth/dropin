import assert from "node:assert/strict";
import test from "node:test";
import {
  auditAttestationDraftSchema,
  baselineSnapshotInputSchema,
  baselineSnapshotSchema,
  observationEventInputSchema,
  observationEventSchema,
  satelliteCertificateRequestSchema,
  satelliteProofReplayFixtureSchema,
  satelliteReplayRootsSchema,
  satelliteUnlockRequestSchema,
} from "../../packages/schemas/src/satellite-proof.schema.js";
import { DeterministicAuditAdapter } from "../../services/satellite-ingestor/src/adapters/audit-adapter.js";
import { DeterministicLandsatAdapter } from "../../services/satellite-ingestor/src/adapters/landsat-adapter.js";
import { DeterministicPlanetAdapter } from "../../services/satellite-ingestor/src/adapters/planet-adapter.js";
import { DeterministicSarAdapter } from "../../services/satellite-ingestor/src/adapters/sar-adapter.js";
import { DeterministicSentinelAdapter } from "../../services/satellite-ingestor/src/adapters/sentinel-adapter.js";
import {
  buildAuditAttestation,
  buildBaselineSnapshot,
  buildObservationEvent,
  vegetationGrowthToCanopyEvent,
} from "../../services/satellite-ingestor/src/root-builder.js";

const baselineInput = {
  gridId: "grid_schema_critical",
  timestamp: "2026-07-01T00:00:00.000Z",
  source: "sentinel-2" as const,
  canopyCoverPct: 44,
  ndvi: 0.61,
  sarBackscatterDb: null,
};
const observationInput = {
  gridId: baselineInput.gridId,
  timestamp: "2026-07-02T00:00:00.000Z",
  source: "planet" as const,
  eventType: "growth" as const,
  canopyCoverPct: 45,
  ndvi: 0.63,
  sarBackscatterDb: null,
  treeSurvivalRate: 91,
  waterStressIndex: 0.1,
  anomalyConfidence: 0.2,
  anomalyThreshold: 0.8,
};
const roots = {
  stateRoot: "a".repeat(64),
  certificateRoot: "b".repeat(64),
  unlockRoot: "c".repeat(64),
  challengeRoot: "d".repeat(64),
};

test("satellite input schemas apply defaults and reject sensor/source inconsistencies", () => {
  const defaultedBaseline = baselineSnapshotInputSchema.parse({
    ...baselineInput,
    sarBackscatterDb: undefined,
  });
  assert.equal(defaultedBaseline.sarBackscatterDb, null);
  assert.equal(
    baselineSnapshotInputSchema.safeParse({
      ...baselineInput,
      ndvi: null,
      sarBackscatterDb: null,
    }).success,
    false,
  );
  assert.equal(
    baselineSnapshotInputSchema.safeParse({
      ...baselineInput,
      source: "sentinel-1",
      sarBackscatterDb: null,
    }).success,
    false,
  );
  assert.equal(
    baselineSnapshotInputSchema.safeParse({
      ...baselineInput,
      source: "landsat",
      ndvi: null,
      sarBackscatterDb: -8,
    }).success,
    false,
  );

  const defaultedObservation = observationEventInputSchema.parse({
    ...observationInput,
    canopyCoverPct: undefined,
    sarBackscatterDb: undefined,
    treeSurvivalRate: undefined,
    waterStressIndex: undefined,
    anomalyThreshold: undefined,
  });
  assert.equal(defaultedObservation.canopyCoverPct, null);
  assert.equal(defaultedObservation.anomalyThreshold, 0.8);
  assert.equal(
    observationEventInputSchema.safeParse({
      ...observationInput,
      canopyCoverPct: null,
      ndvi: null,
      sarBackscatterDb: null,
      treeSurvivalRate: null,
      waterStressIndex: null,
    }).success,
    false,
  );
  for (const source of ["iceye", "capella"] as const) {
    assert.equal(
      observationEventInputSchema.safeParse({
        ...observationInput,
        source,
        sarBackscatterDb: null,
      }).success,
      false,
    );
  }
});

test("satellite output, audit, certificate, unlock, replay, and fixture schemas are strict", () => {
  const baseline = buildBaselineSnapshot(baselineInput);
  const observation = buildObservationEvent(observationInput);
  const auditDraft = {
    gridId: baseline.gridId,
    timestamp: "2026-07-03T00:00:00.000Z",
    source: "drone" as const,
    auditorId: "auditor_schema",
    verifiedCanopyCoverPct: 44.5,
    verifiedTreeSurvivalRate: 90,
    verifiedTco2eDelta: 15,
    auditorSignature: "schema-auditor-signature-00000000000000000001",
  };

  assert.deepEqual(baselineSnapshotSchema.parse(baseline), baseline);
  assert.deepEqual(observationEventSchema.parse(observation), observation);
  assert.deepEqual(auditAttestationDraftSchema.parse(auditDraft), auditDraft);
  assert.deepEqual(satelliteReplayRootsSchema.parse(roots), roots);
  assert.equal(
    satelliteCertificateRequestSchema.parse({
      certificateId: "certificate_schema",
      timestamp: "2026-07-04T00:00:00.000Z",
      verifiedTco2e: 10,
      methodologyVersion: "methodology_v1",
    }).verifiedTco2e,
    10,
  );
  assert.equal(
    satelliteUnlockRequestSchema.parse({
      unlockId: "unlock_schema",
      timestamp: "2026-07-05T00:00:00.000Z",
      token: "CANOPY",
      amount: "0.25",
    }).amount,
    "0.25",
  );
  for (const amount of ["0", "-1", "1e2", "9".repeat(400)]) {
    assert.equal(
      satelliteUnlockRequestSchema.safeParse({
        unlockId: "unlock_schema",
        timestamp: "2026-07-05T00:00:00.000Z",
        token: "CANOPY",
        amount,
      }).success,
      false,
    );
  }

  const fixture = {
    schemaVersion: "canopyproof-satellite-proof-fixture/v1" as const,
    baseline: baselineInput,
    observation: observationInput,
    audit: auditDraft,
    certificate: {
      certificateId: "certificate_schema",
      timestamp: "2026-07-04T00:00:00.000Z",
      verifiedTco2e: 10,
      methodologyVersion: "methodology_v1",
    },
    expectedRoots: roots,
  };
  assert.equal(satelliteProofReplayFixtureSchema.parse(fixture).unlock, undefined);
  assert.equal(
    satelliteProofReplayFixtureSchema.safeParse({ ...fixture, unexpected: true }).success,
    false,
  );
  assert.equal(
    auditAttestationDraftSchema.safeParse({ ...auditDraft, auditorSignature: "short" }).success,
    false,
  );
});

test("deterministic adapters reject records owned by another provider family", () => {
  const sentinel = new DeterministicSentinelAdapter();
  const landsat = new DeterministicLandsatAdapter();
  const planet = new DeterministicPlanetAdapter();
  const sar = new DeterministicSarAdapter();
  const auditAdapter = new DeterministicAuditAdapter();

  assert.match(sentinel.adapterId, /sentinel/);
  assert.match(landsat.adapterId, /landsat/);
  assert.match(planet.adapterId, /planet/);
  assert.match(sar.adapterId, /sar/);
  assert.match(auditAdapter.adapterId, /audit/);
  assert.equal(auditAdapter.mockOnly, true);

  assert.throws(
    () => sentinel.ingest({ ...baselineInput, source: "landsat" }),
    /only sentinel-1 or sentinel-2/,
  );
  assert.throws(
    () => landsat.ingest(baselineInput),
    /only landsat/,
  );
  assert.throws(
    () =>
      planet.ingest({
        ...observationInput,
        source: "iceye",
        sarBackscatterDb: -9,
      }),
    /only planet/,
  );
  assert.throws(
    () => sar.ingest(observationInput),
    /only iceye or capella/,
  );
  assert.throws(
    () =>
      auditAdapter.ingest({
        gridId: baselineInput.gridId,
        timestamp: "2026-07-03T00:00:00.000Z",
        source: "drone",
        auditorId: "audit_adapter",
        baselineRoot: "a".repeat(64),
        observationRoot: "b".repeat(64),
        verifiedCanopyCoverPct: 50,
        verifiedTreeSurvivalRate: 90,
        verifiedTco2eDelta: 1,
        auditorSignature: "short",
      }),
    /too small|at least 16/i,
  );
});

test("root builder emits growth only for growth observations and binds audit lineage", () => {
  const baseline = buildBaselineSnapshot(baselineInput);
  const growth = buildObservationEvent(observationInput);
  const stress = buildObservationEvent({
    ...observationInput,
    eventType: "water_stress",
    waterStressIndex: 0.9,
  });
  assert.ok(vegetationGrowthToCanopyEvent(growth, baseline.baselineRoot));
  assert.equal(vegetationGrowthToCanopyEvent(stress, baseline.baselineRoot), undefined);

  const audit = buildAuditAttestation({
    gridId: baseline.gridId,
    timestamp: "2026-07-03T00:00:00.000Z",
    source: "maxar",
    auditorId: "audit_root_builder",
    baselineRoot: baseline.baselineRoot,
    observationRoot: growth.observationRoot,
    verifiedCanopyCoverPct: 45,
    verifiedTreeSurvivalRate: 90,
    verifiedTco2eDelta: 2,
    auditorSignature: "root-builder-signature-00000000000000000001",
  });
  assert.match(audit.auditRoot, /^[a-f0-9]{64}$/);
});
