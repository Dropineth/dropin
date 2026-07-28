import assert from "node:assert/strict";
import test from "node:test";
import {
  replayCanopyEvents,
  type CanopyEvent,
} from "../../packages/dropin-protocol/src/index.js";
import { DeterministicSatelliteIngestor } from "../../services/satellite-ingestor/src/index.js";

const cellId = "cell_sahel_001";
const fixture = {
  schemaVersion: "canopyproof-satellite-proof-fixture/v1" as const,
  baseline: {
    gridId: cellId,
    timestamp: "2026-01-01T00:00:00.000Z",
    source: "sentinel-2" as const,
    canopyCoverPct: 40,
    ndvi: 0.5,
    sarBackscatterDb: null,
  },
  observation: {
    gridId: cellId,
    timestamp: "2026-01-02T00:00:00.000Z",
    source: "planet" as const,
    eventType: "growth" as const,
    canopyCoverPct: 42,
    ndvi: 0.57,
    sarBackscatterDb: null,
    treeSurvivalRate: 90,
    waterStressIndex: 0.2,
    anomalyConfidence: 0.2,
    anomalyThreshold: 0.8,
  },
  audit: {
    gridId: cellId,
    timestamp: "2026-01-03T00:00:00.000Z",
    source: "field_validator" as const,
    auditorId: "verifier_001",
    verifiedCanopyCoverPct: 41.5,
    verifiedTreeSurvivalRate: 89,
    verifiedTco2eDelta: 80,
    auditorSignature: "mock-auditor-signature-000000000000000000000001",
  },
  certificate: {
    certificateId: "cert_sahel_001",
    timestamp: "2026-01-05T00:00:00.000Z",
    verifiedTco2e: 60,
    methodologyVersion: "canopy-pos-v1",
  },
  unlock: {
    unlockId: "unlock_sahel_001",
    timestamp: "2026-01-06T00:00:00.000Z",
    token: "CANOPY" as const,
    amount: "1000",
  },
};
const unlockGovernance = { CANOPY_PRODUCTION_UNLOCK: true } as const;
const baseEvents: readonly CanopyEvent[] = new DeterministicSatelliteIngestor().replayFixture(
  fixture,
  unlockGovernance,
).events;

test("Canopy state machine replay is deterministic and exposes canonical roots", () => {
  const first = replayCanopyEvents(baseEvents, unlockGovernance);
  const second = replayCanopyEvents(baseEvents, unlockGovernance);

  assert.equal(first.state.stateRoot, second.state.stateRoot);
  assert.equal(first.state.certificateRoot, second.state.certificateRoot);
  assert.equal(first.state.unlockRoot, second.state.unlockRoot);
  assert.equal(first.state.challengeRoot, second.state.challengeRoot);
  assert.equal(first.latestReplayReportId, second.latestReplayReportId);
  assert.equal(first.state.certificates.cert_sahel_001?.status, "issued");
  assert.equal(first.state.unlocks.unlock_sahel_001?.status, "authorized");
  assert.deepEqual(first.canonicalEventTypes, [
    "CellObserved",
    "SequestrationVerified",
    "WaterConstraintUpdated",
    "FireRiskRaised",
    "BaselineAnchored",
    "ObservationEvent",
    "VegetationGrowthDetected",
    "AuditAttested",
    "CertificateIssued",
    "UnlockAuthorized",
    "ChallengeOpened",
    "ChallengeResolved",
  ]);
});

test("Canopy state machine rejects unlock before issued certificate", () => {
  assert.throws(
    () =>
      replayCanopyEvents([
        baseEvents[0]!,
        {
          id: "evt_unlock_early",
          type: "UnlockAuthorized",
          cellId: "cell_sahel_001",
          timestamp: "2026-01-02T00:00:00.000Z",
          unlockId: "unlock_early",
          certificateId: "cert_missing",
          token: "CANOPY",
          amount: "1000",
        },
      ], unlockGovernance),
    /requires CertificateIssued/,
  );
});

test("Canopy state machine rejects duplicate certificate issuance from one audit root", () => {
  const certificateEvent = baseEvents.find((event) => event.type === "CertificateIssued");
  assert.ok(certificateEvent);

  assert.throws(
    () =>
      replayCanopyEvents([
        ...baseEvents.filter((event) => event.type !== "UnlockAuthorized"),
        {
          ...certificateEvent,
          id: "evt_certificate_duplicate_audit",
          certificateId: "cert_sahel_duplicate_audit",
          timestamp: "2026-01-06T00:00:00.000Z",
        },
      ], unlockGovernance),
    /AuditAttested root has already been consumed/,
  );
});

test("Canopy challenges cannot target an object owned by another cell", () => {
  assert.throws(
    () =>
      replayCanopyEvents([
        ...baseEvents,
        {
          id: "evt_other_cell",
          type: "CellObserved",
          cellId: "cell_other_001",
          timestamp: "2026-01-07T00:00:00.000Z",
          treeCount: 0,
          observedBiomassTonnes: 0,
          carryingCapacityTonnes: 0,
        },
        {
          id: "evt_cross_cell_challenge",
          type: "ChallengeOpened",
          cellId: "cell_other_001",
          timestamp: "2026-01-08T00:00:00.000Z",
          challengeId: "challenge_cross_cell_001",
          targetType: "certificate",
          targetId: "cert_sahel_001",
          reason: "cross-cell target substitution attempt",
        },
      ], unlockGovernance),
    /challenge target does not exist/,
  );
});

test("Canopy challenge opens freeze certificate and unlock side effects", () => {
  const challenged = replayCanopyEvents([
    ...baseEvents,
    {
      id: "evt_challenge_open_001",
      type: "ChallengeOpened",
      cellId,
      timestamp: "2026-01-07T00:00:00.000Z",
      challengeId: "challenge_cert_001",
      targetType: "certificate",
      targetId: "cert_sahel_001",
      reason: "satellite inconsistency",
    },
  ], unlockGovernance);

  assert.equal(challenged.state.certificates.cert_sahel_001?.status, "frozen");
  assert.equal(challenged.state.unlocks.unlock_sahel_001?.status, "frozen");
  assert.deepEqual(challenged.state.cells.cell_sahel_001?.openChallengeIds, ["challenge_cert_001"]);
  assert.throws(
    () =>
      replayCanopyEvents([
        ...baseEvents,
        {
          id: "evt_challenge_open_001",
          type: "ChallengeOpened",
          cellId,
          timestamp: "2026-01-07T00:00:00.000Z",
          challengeId: "challenge_cert_001",
          targetType: "certificate",
          targetId: "cert_sahel_001",
          reason: "satellite inconsistency",
        },
        {
          id: "evt_unlock_while_frozen",
          type: "UnlockAuthorized",
          cellId: "cell_sahel_001",
          timestamp: "2026-01-08T00:00:00.000Z",
          unlockId: "unlock_frozen",
          certificateId: "cert_sahel_001",
          token: "CANOPY",
          amount: "1000",
        },
      ], unlockGovernance),
    /unresolved ChallengeOpened/,
  );
});

test("Canopy challenge resolution rejects or restores certificate and unlock state", () => {
  const accepted = replayCanopyEvents([
    ...baseEvents,
    {
      id: "evt_challenge_open_001",
      type: "ChallengeOpened",
      cellId,
      timestamp: "2026-01-07T00:00:00.000Z",
      challengeId: "challenge_cert_001",
      targetType: "certificate",
      targetId: "cert_sahel_001",
      reason: "satellite inconsistency",
    },
    {
      id: "evt_challenge_resolved_accepted",
      type: "ChallengeResolved",
      cellId,
      timestamp: "2026-01-08T00:00:00.000Z",
      challengeId: "challenge_cert_001",
      resolution: "accepted",
    },
  ], unlockGovernance);
  const rejected = replayCanopyEvents([
    ...baseEvents,
    {
      id: "evt_challenge_open_002",
      type: "ChallengeOpened",
      cellId,
      timestamp: "2026-01-07T00:00:00.000Z",
      challengeId: "challenge_cert_002",
      targetType: "certificate",
      targetId: "cert_sahel_001",
      reason: "satellite inconsistency",
    },
    {
      id: "evt_challenge_resolved_rejected",
      type: "ChallengeResolved",
      cellId,
      timestamp: "2026-01-08T00:00:00.000Z",
      challengeId: "challenge_cert_002",
      resolution: "rejected",
    },
  ], unlockGovernance);

  assert.equal(accepted.state.certificates.cert_sahel_001?.status, "rolled_back");
  assert.equal(accepted.state.unlocks.unlock_sahel_001?.status, "rolled_back");
  assert.equal(rejected.state.certificates.cert_sahel_001?.status, "issued");
  assert.equal(rejected.state.unlocks.unlock_sahel_001?.status, "authorized");
});

test("resolving one challenge cannot thaw effects still covered by another open challenge", () => {
  const twoChallenges: readonly CanopyEvent[] = [
    ...baseEvents,
    {
      id: "evt_challenge_cell_concurrent",
      type: "ChallengeOpened",
      cellId,
      timestamp: "2026-01-07T00:00:00.000Z",
      challengeId: "challenge_cell_concurrent",
      targetType: "cell",
      targetId: cellId,
      reason: "cell-wide remote sensing discrepancy",
    },
    {
      id: "evt_challenge_certificate_concurrent",
      type: "ChallengeOpened",
      cellId,
      timestamp: "2026-01-08T00:00:00.000Z",
      challengeId: "challenge_certificate_concurrent",
      targetType: "certificate",
      targetId: "cert_sahel_001",
      reason: "certificate-specific audit discrepancy",
    },
  ];
  const oneResolved = replayCanopyEvents([
    ...twoChallenges,
    {
      id: "evt_challenge_cell_concurrent_rejected",
      type: "ChallengeResolved",
      cellId,
      timestamp: "2026-01-09T00:00:00.000Z",
      challengeId: "challenge_cell_concurrent",
      resolution: "rejected",
    },
  ], unlockGovernance);

  assert.equal(oneResolved.state.certificates.cert_sahel_001?.status, "frozen");
  assert.equal(oneResolved.state.unlocks.unlock_sahel_001?.status, "frozen");
  assert.deepEqual(
    oneResolved.state.cells.cell_sahel_001?.openChallengeIds,
    ["challenge_certificate_concurrent"],
  );

  const allResolved = replayCanopyEvents([
    ...twoChallenges,
    {
      id: "evt_challenge_cell_concurrent_rejected",
      type: "ChallengeResolved",
      cellId,
      timestamp: "2026-01-09T00:00:00.000Z",
      challengeId: "challenge_cell_concurrent",
      resolution: "rejected",
    },
    {
      id: "evt_challenge_certificate_concurrent_rejected",
      type: "ChallengeResolved",
      cellId,
      timestamp: "2026-01-10T00:00:00.000Z",
      challengeId: "challenge_certificate_concurrent",
      resolution: "rejected",
    },
  ], unlockGovernance);

  assert.equal(allResolved.state.certificates.cert_sahel_001?.status, "issued");
  assert.equal(allResolved.state.unlocks.unlock_sahel_001?.status, "authorized");
  assert.deepEqual(allResolved.state.cells.cell_sahel_001?.openChallengeIds, []);
});
