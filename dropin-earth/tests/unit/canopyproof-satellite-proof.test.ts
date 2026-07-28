import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  canopyChallengeIdForObservation,
  replayCanopyEvents,
  type CanopyEvent,
} from "../../packages/dropin-protocol/src/index.js";
import {
  satelliteProofReplayFixtureSchema,
  type SatelliteProofReplayFixture,
} from "../../packages/schemas/src/satellite-proof.schema.js";
import {
  DeterministicSatelliteIngestor,
  baselineSnapshotToCanopyEvent,
  observationToCanopyEvent,
} from "../../services/satellite-ingestor/src/index.js";

const fixturePath = join(process.cwd(), "tests/fixtures/canopyproof-satellite-proof-replay.json");
const fixture = satelliteProofReplayFixtureSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
const ingestor = new DeterministicSatelliteIngestor();
const unlockGovernance = { CANOPY_PRODUCTION_UNLOCK: true } as const;

function fixtureWithoutUnlock(input: SatelliteProofReplayFixture): SatelliteProofReplayFixture {
  return {
    schemaVersion: input.schemaVersion,
    baseline: input.baseline,
    observation: input.observation,
    audit: input.audit,
    certificate: input.certificate,
  };
}

function highRiskFixture(): SatelliteProofReplayFixture {
  return {
    ...fixtureWithoutUnlock(fixture),
    observation: {
      ...fixture.observation,
      eventType: "deforestation",
      canopyCoverPct: 31.2,
      ndvi: 0.19,
      treeSurvivalRate: 54,
      anomalyConfidence: 0.96,
      anomalyThreshold: 0.8,
    },
  };
}

test("valid baseline -> observation -> audit -> certificate -> unlock replay succeeds", () => {
  const result = ingestor.replayFixture(fixture, unlockGovernance);

  assert.equal(result.replay.state.baselines[result.baseline.baselineRoot]?.cellId, fixture.baseline.gridId);
  assert.equal(result.replay.state.observations[result.observation.observationRoot]?.observationType, "growth");
  assert.equal(result.replay.state.audits[result.audit.auditRoot]?.auditorId, fixture.audit.auditorId);
  assert.equal(result.replay.state.cells[fixture.baseline.gridId]?.vegetationGrowthDetected, true);
  assert.equal(result.replay.state.certificates[fixture.certificate.certificateId]?.status, "issued");
  assert.equal(result.replay.state.unlocks[fixture.unlock?.unlockId ?? ""]?.status, "authorized");
  assert.deepEqual(result.replay.emittedChallengeIds, []);
});

test("ObservationEvent without BaselineAnchored is rejected", () => {
  const observation = ingestor.ingestObservation(fixture.observation);
  const event = observationToCanopyEvent(observation, "0".repeat(64));

  assert.throws(() => replayCanopyEvents([event]), /baseline-anchored|BaselineAnchored/);
});

test("VegetationGrowthDetected cannot precede BaselineAnchored and its linked ObservationEvent", () => {
  assert.throws(
    () =>
      replayCanopyEvents([
        {
          id: "evt_cell_before_growth_without_baseline",
          type: "CellObserved",
          cellId: fixture.baseline.gridId,
          timestamp: "2026-06-30T00:00:00.000Z",
          treeCount: 0,
          observedBiomassTonnes: 0,
          carryingCapacityTonnes: 0,
        },
        {
          id: "evt_growth_without_baseline",
          type: "VegetationGrowthDetected",
          cellId: fixture.baseline.gridId,
          timestamp: fixture.observation.timestamp,
          baselineRoot: "0".repeat(64),
          observationRoot: "1".repeat(64),
        },
      ]),
    /BaselineAnchored must exist before VegetationGrowthDetected/,
  );
});

test("high-risk observation above threshold emits deterministic ChallengeOpened state", () => {
  const risky = highRiskFixture();
  const baseline = ingestor.ingestBaseline(risky.baseline);
  const observation = ingestor.ingestObservation(risky.observation);
  const events: readonly CanopyEvent[] = [
    baselineSnapshotToCanopyEvent(baseline),
    observationToCanopyEvent(observation, baseline.baselineRoot),
  ];
  const report = replayCanopyEvents(events);
  const repeated = replayCanopyEvents(events);
  const challengeId = canopyChallengeIdForObservation(observation.observationRoot);

  assert.deepEqual(report.emittedChallengeIds, [challengeId]);
  assert.equal(report.emittedEvents[0]?.type, "ChallengeOpened");
  assert.equal(report.emittedEvents[0]?.challengeId, challengeId);
  assert.equal(report.state.challenges[challengeId]?.status, "open");
  assert.equal(report.state.challenges[challengeId]?.sourceObservationRoot, observation.observationRoot);
  assert.deepEqual(report.state.cells[baseline.gridId]?.openChallengeIds, [challengeId]);
  assert.equal(report.state.challengeRoot, repeated.state.challengeRoot);
  assert.equal(report.state.stateRoot, repeated.state.stateRoot);
});

test("derived ChallengeOpened is a first-class replay event with stable observation lineage", () => {
  const risky = highRiskFixture();
  const baseline = ingestor.ingestBaseline(risky.baseline);
  const observation = ingestor.ingestObservation(risky.observation);
  const sourceEvents: readonly CanopyEvent[] = [
    baselineSnapshotToCanopyEvent(baseline),
    observationToCanopyEvent(observation, baseline.baselineRoot),
  ];
  const first = replayCanopyEvents(sourceEvents);
  const challengeEvent = first.emittedEvents[0];
  assert.ok(challengeEvent);

  assert.equal(challengeEvent.sourceObservationRoot, observation.observationRoot);
  assert.equal(challengeEvent.automaticallyOpened, true);
  assert.ok(first.state.appliedEventIds.includes(challengeEvent.id));
  assert.equal(
    first.state.challenges[challengeEvent.challengeId]?.openedByEventId,
    challengeEvent.id,
  );

  const persistedReplay = replayCanopyEvents([...sourceEvents, challengeEvent]);
  assert.equal(persistedReplay.state.stateRoot, first.state.stateRoot);
  assert.equal(persistedReplay.state.challengeRoot, first.state.challengeRoot);
  assert.equal(persistedReplay.eventCount, first.eventCount);
});

test("CertificateIssued is rejected while a satellite challenge is unresolved", () => {
  assert.throws(
    () => ingestor.replayFixture(highRiskFixture()),
    /unresolved ChallengeOpened/,
  );
});

test("CertificateIssued is rejected when its AuditAttested event is absent", () => {
  const replay = ingestor.replayFixture(fixtureWithoutUnlock(fixture));
  const withoutAudit = replay.events.filter((event) => event.type !== "AuditAttested");

  assert.throws(
    () => replayCanopyEvents(withoutAudit),
    /requires AuditAttested/,
  );
});

test("UnlockAuthorized is rejected without CertificateIssued", () => {
  const baseline = ingestor.ingestBaseline(fixture.baseline);
  const events: readonly CanopyEvent[] = [
    baselineSnapshotToCanopyEvent(baseline),
    {
      id: "evt_unlock_without_certificate",
      type: "UnlockAuthorized",
      cellId: baseline.gridId,
      timestamp: "2026-07-12T00:00:00.000Z",
      unlockId: "unlock_without_certificate",
      certificateId: "certificate_missing",
      token: "CANOPY",
      amount: "1",
    },
  ];

  assert.throws(
    () => replayCanopyEvents(events, unlockGovernance),
    /requires CertificateIssued/,
  );
});

test("same three-layer inputs always produce identical state, certificate, unlock, and challenge roots", () => {
  const first = ingestor.replayFixture(fixture, unlockGovernance).replay;
  const second = ingestor.replayFixture(fixture, unlockGovernance).replay;

  assert.equal(first.state.stateRoot, second.state.stateRoot);
  assert.equal(first.state.certificateRoot, second.state.certificateRoot);
  assert.equal(first.state.unlockRoot, second.state.unlockRoot);
  assert.equal(first.state.challengeRoot, second.state.challengeRoot);
  assert.equal(first.latestReplayReportId, second.latestReplayReportId);
  assert.deepEqual(
    {
      stateRoot: first.state.stateRoot,
      certificateRoot: first.state.certificateRoot,
      unlockRoot: first.state.unlockRoot,
      challengeRoot: first.state.challengeRoot,
    },
    fixture.expectedRoots,
  );
});

test("protocol unlock write path is fail-closed without CANOPY_PRODUCTION_UNLOCK=true", () => {
  assert.throws(
    () => ingestor.replayFixture(fixture),
    /CANOPY_PRODUCTION_UNLOCK=true/,
  );
});

test("fixture adapters and proof roots are deterministic without provider network calls", () => {
  const first = ingestor.replayFixture(fixtureWithoutUnlock(fixture));
  const second = ingestor.replayFixture(fixtureWithoutUnlock(fixture));

  assert.equal(ingestor.implementationGate, "mock_fixtures_only");
  assert.equal(ingestor.sentinel.mockOnly, true);
  assert.equal(ingestor.planet.mockOnly, true);
  assert.equal(ingestor.audit.mockOnly, true);
  assert.equal(first.baseline.baselineRoot, second.baseline.baselineRoot);
  assert.equal(first.observation.observationRoot, second.observation.observationRoot);
  assert.equal(first.audit.auditRoot, second.audit.auditRoot);
});

test("all declared baseline, optical observation, SAR observation, and audit mock adapters normalize fixtures", () => {
  const sentinelSar = ingestor.ingestBaseline({
    gridId: "grid_adapter_sentinel_1",
    timestamp: "2026-07-01T00:00:00.000Z",
    source: "sentinel-1",
    canopyCoverPct: 38,
    ndvi: null,
    sarBackscatterDb: -11.2,
  });
  const landsat = ingestor.ingestBaseline({
    gridId: "grid_adapter_landsat",
    timestamp: "2026-07-01T00:00:00.000Z",
    source: "landsat",
    canopyCoverPct: 39,
    ndvi: 0.47,
    sarBackscatterDb: null,
  });
  const iceye = ingestor.ingestObservation({
    gridId: "grid_adapter_sentinel_1",
    timestamp: "2026-07-02T00:00:00.000Z",
    source: "iceye",
    eventType: "water_stress",
    canopyCoverPct: null,
    ndvi: null,
    sarBackscatterDb: -10.6,
    treeSurvivalRate: null,
    waterStressIndex: 0.72,
    anomalyConfidence: 0.65,
    anomalyThreshold: 0.8,
  });
  const capella = ingestor.ingestObservation({
    gridId: "grid_adapter_sentinel_1",
    timestamp: "2026-07-03T00:00:00.000Z",
    source: "capella",
    eventType: "fire_risk",
    canopyCoverPct: null,
    ndvi: null,
    sarBackscatterDb: -9.9,
    treeSurvivalRate: null,
    waterStressIndex: null,
    anomalyConfidence: 0.7,
    anomalyThreshold: 0.8,
  });

  assert.match(sentinelSar.baselineRoot, /^[a-f0-9]{64}$/);
  assert.match(landsat.baselineRoot, /^[a-f0-9]{64}$/);
  assert.equal(iceye.source, "iceye");
  assert.equal(capella.source, "capella");
  assert.equal(ingestor.sar.mockOnly, true);
});

test("canonical roots bind measurements and reject tampered replay events or fixture expectations", () => {
  const baseline = ingestor.ingestBaseline(fixture.baseline);
  const changed = ingestor.ingestBaseline({ ...fixture.baseline, ndvi: 0.59 });
  assert.notEqual(changed.baselineRoot, baseline.baselineRoot);

  const tamperedEvent = {
    ...baselineSnapshotToCanopyEvent(baseline),
    baselineRoot: "f".repeat(64),
  } as const;
  assert.throws(() => replayCanopyEvents([tamperedEvent]), /baselineRoot does not match/);

  assert.ok(fixture.expectedRoots);
  assert.throws(
    () =>
      ingestor.replayFixture(
        {
          ...fixture,
          expectedRoots: { ...fixture.expectedRoots, stateRoot: "0".repeat(64) },
        },
        unlockGovernance,
      ),
    /expectedRoots do not match/,
  );
});
