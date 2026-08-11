import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCanopyEvent,
  computeCanopyAuditRoot,
  computeCanopyBaselineRoot,
  computeCanopyObservationRoot,
  replayCanopyEvents,
  satelliteChallengeOpenedForObservation,
  type CanopyAuditAttestedEvent,
  type CanopyBaselineAnchoredEvent,
  type CanopyChallengeOpenedEvent,
  type CanopyCertificateIssuedEvent,
  type CanopyEvent,
  type CanopyObservationEvent,
  type CanopyState,
  type CanopyUnlockAuthorizedEvent,
} from "../../packages/dropin-protocol/src/index.js";
import { DeterministicSatelliteIngestor } from "../../services/satellite-ingestor/src/index.js";

const cellId = "cell_critical_coverage";
const unlockGovernance = { CANOPY_PRODUCTION_UNLOCK: true } as const;
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
    auditorId: "verifier_critical",
    verifiedCanopyCoverPct: 41.5,
    verifiedTreeSurvivalRate: 89,
    verifiedTco2eDelta: 80,
    auditorSignature: "critical-auditor-signature-00000000000000000001",
  },
  certificate: {
    certificateId: "cert_critical",
    timestamp: "2026-01-05T00:00:00.000Z",
    verifiedTco2e: 60,
    methodologyVersion: "canopy-pos-v1",
  },
  unlock: {
    unlockId: "unlock_critical",
    timestamp: "2026-01-06T00:00:00.000Z",
    token: "CANOPY" as const,
    amount: "1000",
  },
};

const ingestor = new DeterministicSatelliteIngestor();
const validEvents: readonly CanopyEvent[] = ingestor.replayFixture(fixture, unlockGovernance).events;

function eventOf<T extends CanopyEvent["type"]>(
  type: T,
): Extract<CanopyEvent, { readonly type: T }> {
  const event = validEvents.find((candidate) => candidate.type === type);
  assert.ok(event, `${type} fixture event must exist`);
  return event as Extract<CanopyEvent, { readonly type: T }>;
}

const baseline = eventOf("BaselineAnchored");
const observation = eventOf("ObservationEvent");
const audit = eventOf("AuditAttested");
const certificate = eventOf("CertificateIssued");
const unlock = eventOf("UnlockAuthorized");

function replayPrefix(type: CanopyEvent["type"]): readonly CanopyEvent[] {
  const index = validEvents.findIndex((event) => event.type === type);
  assert.notEqual(index, -1);
  return validEvents.slice(0, index);
}

function withBaselineRoot(
  event: CanopyBaselineAnchoredEvent,
  changes: Partial<CanopyBaselineAnchoredEvent>,
): CanopyBaselineAnchoredEvent {
  const changed = { ...event, ...changes };
  return {
    ...changed,
    baselineRoot: computeCanopyBaselineRoot({
      gridId: changed.cellId,
      timestamp: changed.timestamp,
      source: changed.source,
      canopyCoverPct: changed.canopyCoverPct,
      ndvi: changed.ndvi,
      sarBackscatterDb: changed.sarBackscatterDb,
    }),
  };
}

function withObservationRoot(
  event: CanopyObservationEvent,
  changes: Partial<CanopyObservationEvent>,
): CanopyObservationEvent {
  const changed = { ...event, ...changes };
  return {
    ...changed,
    observationRoot: computeCanopyObservationRoot({
      gridId: changed.cellId,
      timestamp: changed.timestamp,
      source: changed.source,
      observationType: changed.observationType,
      canopyCoverPct: changed.canopyCoverPct,
      ndvi: changed.ndvi,
      sarBackscatterDb: changed.sarBackscatterDb,
      treeSurvivalRate: changed.treeSurvivalRate,
      waterStressIndex: changed.waterStressIndex,
      anomalyConfidence: changed.anomalyConfidence,
      anomalyThreshold: changed.anomalyThreshold,
    }),
  };
}

function withAuditRoot(
  event: CanopyAuditAttestedEvent,
  changes: Partial<CanopyAuditAttestedEvent>,
): CanopyAuditAttestedEvent {
  const changed = { ...event, ...changes };
  return {
    ...changed,
    auditRoot: computeCanopyAuditRoot({
      gridId: changed.cellId,
      timestamp: changed.timestamp,
      source: changed.source,
      auditorId: changed.auditorId,
      baselineRoot: changed.baselineRoot,
      observationRoot: changed.observationRoot,
      verifiedCanopyCoverPct: changed.verifiedCanopyCoverPct,
      verifiedTreeSurvivalRate: changed.verifiedTreeSurvivalRate,
      verifiedTco2eDelta: changed.verifiedTco2eDelta,
      auditorSignature: changed.auditorSignature,
    }),
  };
}

test("baseline validation rejects missing sensor values, source mismatches, invalid ranges, and duplicate roots", () => {
  const prefix = replayPrefix("BaselineAnchored");
  const cases: readonly [CanopyBaselineAnchoredEvent, RegExp][] = [
    [
      withBaselineRoot(baseline, { id: "baseline_no_measurement", ndvi: null, sarBackscatterDb: null }),
      /requires an NDVI or SAR measurement/,
    ],
    [
      withBaselineRoot(baseline, { id: "baseline_s1_no_sar", source: "sentinel-1", sarBackscatterDb: null }),
      /Sentinel-1 baseline requires SAR/,
    ],
    [
      withBaselineRoot(baseline, {
        id: "baseline_optical_no_ndvi",
        source: "landsat",
        ndvi: null,
        sarBackscatterDb: -10,
      }),
      /optical baseline requires NDVI/,
    ],
    [
      withBaselineRoot(baseline, { id: "baseline_nan", canopyCoverPct: Number.NaN }),
      /outside its valid range/,
    ],
    [
      withBaselineRoot(baseline, { id: "baseline_ndvi_high", ndvi: 1.1 }),
      /outside its valid range/,
    ],
  ];
  for (const [event, expected] of cases) {
    assert.throws(() => replayCanopyEvents([...prefix, event]), expected);
  }

  assert.throws(
    () => replayCanopyEvents([...prefix, baseline, { ...baseline, id: "duplicate_baseline_event" }]),
    /baselineRoot is already anchored/,
  );
});

test("observation validation rejects missing measurements, wrong baseline, bad time, tampering, duplicates, and SAR omission", () => {
  const prefix = replayPrefix("ObservationEvent");
  const cases: readonly [CanopyObservationEvent, RegExp][] = [
    [
      withObservationRoot(observation, {
        id: "observation_empty",
        canopyCoverPct: null,
        ndvi: null,
        sarBackscatterDb: null,
        treeSurvivalRate: null,
        waterStressIndex: null,
      }),
      /requires a physical measurement/,
    ],
    [
      withObservationRoot(observation, {
        id: "observation_sar_missing",
        source: "iceye",
        sarBackscatterDb: null,
      }),
      /commercial SAR observation requires backscatter/,
    ],
    [
      withObservationRoot(observation, {
        id: "observation_wrong_baseline",
        baselineRoot: "f".repeat(64),
      }),
      /matching BaselineAnchored/,
    ],
    [
      withObservationRoot(observation, {
        id: "observation_before_baseline",
        timestamp: "2025-12-31T23:59:59.000Z",
      }),
      /timestamps are invalid or out of order/,
    ],
    [
      withObservationRoot(observation, {
        id: "observation_invalid_time",
        timestamp: "not-a-time",
      }),
      /timestamps are invalid or out of order/,
    ],
    [
      withObservationRoot(observation, {
        id: "observation_confidence_high",
        anomalyConfidence: 1.1,
      }),
      /outside its valid range/,
    ],
  ];
  for (const [event, expected] of cases) {
    assert.throws(() => replayCanopyEvents([...prefix, event]), expected);
  }

  assert.throws(
    () => replayCanopyEvents([...prefix, { ...observation, id: "observation_tampered", ndvi: 0.9 }]),
    /observationRoot does not match/,
  );
  assert.throws(
    () => replayCanopyEvents([...prefix, observation, { ...observation, id: "duplicate_observation_event" }]),
    /observationRoot is already recorded/,
  );
});

test("audit validation rejects invalid signatures, wrong lineage, time inversion, tampered values, and duplicate roots", () => {
  const prefix = replayPrefix("AuditAttested");
  const cases: readonly [CanopyAuditAttestedEvent, RegExp][] = [
    [withAuditRoot(audit, { id: "audit_short_signature", auditorSignature: "too-short" }), /bounded auditorSignature/],
    [withAuditRoot(audit, { id: "audit_long_signature", auditorSignature: "x".repeat(4097) }), /bounded auditorSignature/],
    [withAuditRoot(audit, { id: "audit_wrong_baseline", baselineRoot: "a".repeat(64) }), /matching BaselineAnchored/],
    [withAuditRoot(audit, { id: "audit_wrong_observation", observationRoot: "b".repeat(64) }), /matching ObservationEvent/],
    [
      withAuditRoot(audit, { id: "audit_before_observation", timestamp: "2026-01-01T12:00:00.000Z" }),
      /timestamps are invalid or out of order/,
    ],
    [withAuditRoot(audit, { id: "audit_survival_high", verifiedTreeSurvivalRate: 101 }), /outside its valid range/],
  ];
  for (const [event, expected] of cases) {
    assert.throws(() => replayCanopyEvents([...prefix, event]), expected);
  }

  assert.throws(
    () => replayCanopyEvents([...prefix, { ...audit, id: "audit_tampered", verifiedCanopyCoverPct: 0 }]),
    /auditRoot does not match/,
  );
  assert.throws(
    () => replayCanopyEvents([...prefix, audit, { ...audit, id: "duplicate_audit_event" }]),
    /auditRoot is already attested/,
  );
});

test("legacy physical events update observed state and reject sequestration against a frozen cell", () => {
  const cell = {
    id: "critical_cell_observed",
    type: "CellObserved",
    cellId,
    timestamp: "2026-01-01T00:00:00.000Z",
    treeCount: 10,
    observedBiomassTonnes: 5,
    carryingCapacityTonnes: 20,
  } as const;
  const events: readonly CanopyEvent[] = [
    cell,
    {
      id: "critical_water",
      type: "WaterConstraintUpdated",
      cellId,
      timestamp: "2026-01-01T01:00:00.000Z",
      waterIndex: 0.4,
      sourceId: "water_sensor",
    },
    {
      id: "critical_fire",
      type: "FireRiskRaised",
      cellId,
      timestamp: "2026-01-01T02:00:00.000Z",
      riskLevel: "high",
      sourceId: "fire_sensor",
    },
    {
      id: "critical_sequestration",
      type: "SequestrationVerified",
      cellId,
      timestamp: "2026-01-01T03:00:00.000Z",
      verifiedTco2e: 4,
      evidenceRoot: "evidence",
      verifierId: "verifier",
    },
  ];
  const report = replayCanopyEvents(events);
  assert.equal(report.state.cells[cellId]?.waterIndex, 0.4);
  assert.equal(report.state.cells[cellId]?.fireRiskLevel, "high");
  assert.equal(report.state.cells[cellId]?.verifiedTco2e, 4);

  const frozenEvents: readonly CanopyEvent[] = [
    cell,
    {
      id: "critical_cell_challenge",
      type: "ChallengeOpened",
      cellId,
      timestamp: "2026-01-01T01:00:00.000Z",
      challengeId: "critical_cell_challenge",
      targetType: "cell",
      targetId: cellId,
      reason: "physical inconsistency",
    },
    events[3]!,
  ];
  assert.throws(() => replayCanopyEvents(frozenEvents), /unresolved ChallengeOpened/);
});

test("growth, certificate, and unlock guards reject mismatched lineage, quantities, identifiers, and decimal syntax", () => {
  const growth = eventOf("VegetationGrowthDetected");
  const nonGrowthObservation = withObservationRoot(observation, {
    id: "observation_not_growth",
    observationId: "observation_not_growth",
    observationType: "water_stress",
  });
  assert.throws(
    () => replayCanopyEvents([...replayPrefix("ObservationEvent"), nonGrowthObservation, { ...growth, observationRoot: nonGrowthObservation.observationRoot }]),
    /matching growth ObservationEvent/,
  );

  const certificatePrefix = replayPrefix("CertificateIssued");
  const certificateCases: readonly [CanopyCertificateIssuedEvent, RegExp][] = [
    [{ ...certificate, id: "certificate_zero", certificateId: "certificate_zero", verifiedTco2e: 0 }, /quantity exceeds/],
    [{ ...certificate, id: "certificate_excess", certificateId: "certificate_excess", verifiedTco2e: 81 }, /quantity exceeds/],
    [{ ...certificate, id: "certificate_wrong_audit", certificateId: "certificate_wrong_audit", auditRoot: "c".repeat(64) }, /requires AuditAttested/],
  ];
  for (const [event, expected] of certificateCases) {
    assert.throws(() => replayCanopyEvents([...certificatePrefix, event]), expected);
  }
  assert.throws(
    () => replayCanopyEvents([...certificatePrefix, certificate, { ...certificate, id: "certificate_id_duplicate" }]),
    /certificateId already exists/,
  );

  const unlockPrefix = replayPrefix("UnlockAuthorized");
  const unlockCases: readonly [CanopyUnlockAuthorizedEvent, RegExp][] = [
    [{ ...unlock, id: "unlock_negative", unlockId: "unlock_negative", amount: "-1" }, /positive decimal/],
    [{ ...unlock, id: "unlock_exponent", unlockId: "unlock_exponent", amount: "1e3" }, /positive decimal/],
    [{ ...unlock, id: "unlock_infinite", unlockId: "unlock_infinite", amount: "9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999" }, /positive decimal/],
  ];
  for (const [event, expected] of unlockCases) {
    assert.throws(() => replayCanopyEvents([...unlockPrefix, event], unlockGovernance), expected);
  }
  assert.throws(
    () => replayCanopyEvents([...unlockPrefix, unlock, { ...unlock, id: "unlock_id_duplicate" }], unlockGovernance),
    /unlockId already exists/,
  );
});

test("manual and automatic challenge lineage is fail-closed and challenge resolution validates identity", () => {
  const stateBeforeObservation = replayCanopyEvents(replayPrefix("ObservationEvent")).state;
  const riskyObservation = withObservationRoot(observation, {
    id: "observation_risky",
    observationId: "observation_risky",
    observationType: "deforestation",
    anomalyConfidence: 0.95,
  });
  const derived = satelliteChallengeOpenedForObservation(riskyObservation);
  assert.ok(derived);
  const withObservation = applyCanopyEvent(stateBeforeObservation, riskyObservation);
  assert.equal(withObservation.challenges[derived.challengeId]?.status, "open");

  const safeObservation = withObservationRoot(observation, {
    id: "observation_safe",
    observationId: "observation_safe",
    observationType: "fire_risk",
    anomalyConfidence: observation.anomalyThreshold,
  });
  assert.equal(satelliteChallengeOpenedForObservation(safeObservation), undefined);

  const validState = replayCanopyEvents(validEvents, unlockGovernance).state;
  const manual: CanopyChallengeOpenedEvent = {
    id: "manual_challenge",
    type: "ChallengeOpened",
    cellId,
    timestamp: "2026-01-07T00:00:00.000Z",
    challengeId: "manual_challenge",
    targetType: "unlock",
    targetId: unlock.unlockId,
    reason: "unlock-specific discrepancy",
  };
  const frozen = applyCanopyEvent(validState, manual, unlockGovernance);
  assert.equal(frozen.unlocks[unlock.unlockId]?.status, "frozen");

  const invalidChallenges: readonly [CanopyChallengeOpenedEvent, RegExp][] = [
    [{ ...manual, id: "manual_duplicate", challengeId: "manual_challenge" }, /challengeId already exists/],
    [
      {
        ...manual,
        id: "automatic_missing_observation",
        challengeId: "automatic_missing_observation",
        sourceObservationRoot: "d".repeat(64),
        automaticallyOpened: true,
      },
      /requires its source ObservationEvent/,
    ],
    [
      {
        ...manual,
        id: "manual_fake_lineage",
        challengeId: "manual_fake_lineage",
        sourceObservationRoot: observation.observationRoot,
      },
      /cannot claim automatic observation lineage/,
    ],
  ];
  for (const [event, expected] of invalidChallenges) {
    assert.throws(() => applyCanopyEvent(frozen, event, unlockGovernance), expected);
  }

  const tamperedDerived = {
    ...derived,
    id: "tampered_automatic_event",
    challengeId: "tampered_automatic_challenge",
    sourceObservationRoot: observation.observationRoot,
    reason: "tampered automatic reason",
  };
  assert.throws(
    () => applyCanopyEvent(validState, tamperedDerived),
    /automatic ChallengeOpened does not match/,
  );
  assert.throws(
    () =>
      applyCanopyEvent(frozen, {
        id: "resolve_missing",
        type: "ChallengeResolved",
        cellId,
        timestamp: "2026-01-08T00:00:00.000Z",
        challengeId: "missing",
        resolution: "rejected",
      }),
    /challenge is not open/,
  );
  assert.throws(
    () =>
      applyCanopyEvent(frozen, {
        id: "resolve_wrong_cell",
        type: "ChallengeResolved",
        cellId: "different_cell",
        timestamp: "2026-01-08T00:00:00.000Z",
        challengeId: manual.challengeId,
        resolution: "rejected",
      }),
    /resolution cell does not match/,
  );
});

test("cell-wide and unlock-specific accepted challenges roll back only affected objects", () => {
  const state = replayCanopyEvents(validEvents, unlockGovernance).state;
  const unlockChallenge: CanopyChallengeOpenedEvent = {
    id: "unlock_challenge_event",
    type: "ChallengeOpened",
    cellId,
    timestamp: "2026-01-07T00:00:00.000Z",
    challengeId: "unlock_challenge",
    targetType: "unlock",
    targetId: unlock.unlockId,
    reason: "unlock reconciliation mismatch",
  };
  const frozen = applyCanopyEvent(state, unlockChallenge, unlockGovernance);
  const resolved = applyCanopyEvent(frozen, {
    id: "unlock_challenge_resolved",
    type: "ChallengeResolved",
    cellId,
    timestamp: "2026-01-08T00:00:00.000Z",
    challengeId: unlockChallenge.challengeId,
    resolution: "accepted",
  });
  assert.equal(resolved.unlocks[unlock.unlockId]?.status, "rolled_back");
  assert.equal(resolved.certificates[certificate.certificateId]?.status, "issued");
});

test("applyCanopyEvent is idempotent and derives exactly one automatic challenge", () => {
  const state = replayCanopyEvents(replayPrefix("ObservationEvent")).state;
  const risky = withObservationRoot(observation, {
    id: "apply_risky_observation",
    observationId: "apply_risky_observation",
    observationType: "survival_drop",
    anomalyConfidence: 0.99,
  });
  const next = applyCanopyEvent(state, risky);
  const repeated = applyCanopyEvent(next, risky);
  assert.equal(Object.keys(next.challenges).length, 1);
  assert.equal(repeated.stateRoot, next.stateRoot);
  assert.equal(repeated.appliedEventIds.length, next.appliedEventIds.length);
});

test("certificate rejects a state whose audit lineage references missing canonical records", () => {
  const validState = replayCanopyEvents(replayPrefix("CertificateIssued")).state;
  const broken: CanopyState = {
    ...validState,
    baselines: {},
  };
  assert.throws(
    () => applyCanopyEvent(broken, certificate),
    /requires BaselineAnchored and ObservationEvent/,
  );
});
