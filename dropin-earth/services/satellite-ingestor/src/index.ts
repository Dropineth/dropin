import {
  satelliteProofReplayFixtureSchema,
  type AuditAttestation,
  type BaselineSnapshot,
  type BaselineSnapshotInput,
  type ObservationEvent,
  type ObservationEventInput,
  type SatelliteProofReplayFixture,
} from "@dropin/schemas/satellite-proof";
import {
  replayCanopyEvents,
  type CanopyEvent,
  type CanopyReplayReport,
  type CanopyStateMachineGovernance,
} from "@dropin/dropin-protocol";
import { DeterministicAuditAdapter } from "./adapters/audit-adapter.js";
import { DeterministicLandsatAdapter } from "./adapters/landsat-adapter.js";
import { DeterministicPlanetAdapter } from "./adapters/planet-adapter.js";
import { DeterministicSarAdapter } from "./adapters/sar-adapter.js";
import { DeterministicSentinelAdapter } from "./adapters/sentinel-adapter.js";
import {
  auditAttestationToCanopyEvent,
  baselineSnapshotToCanopyEvent,
  observationToCanopyEvent,
  vegetationGrowthToCanopyEvent,
} from "./root-builder.js";

export * from "./adapters/audit-adapter.js";
export * from "./adapters/landsat-adapter.js";
export * from "./adapters/planet-adapter.js";
export * from "./adapters/sar-adapter.js";
export * from "./adapters/sentinel-adapter.js";
export * from "./root-builder.js";

export type SatelliteProofPipelineResult = {
  readonly baseline: BaselineSnapshot;
  readonly observation: ObservationEvent;
  readonly audit: AuditAttestation;
  readonly events: readonly CanopyEvent[];
  readonly replay: CanopyReplayReport;
};

export class DeterministicSatelliteIngestor {
  readonly implementationGate = "mock_fixtures_only";
  readonly sentinel = new DeterministicSentinelAdapter();
  readonly landsat = new DeterministicLandsatAdapter();
  readonly planet = new DeterministicPlanetAdapter();
  readonly sar = new DeterministicSarAdapter();
  readonly audit = new DeterministicAuditAdapter();

  ingestBaseline(input: BaselineSnapshotInput): BaselineSnapshot {
    return input.source === "landsat" ? this.landsat.ingest(input) : this.sentinel.ingest(input);
  }

  ingestObservation(input: ObservationEventInput): ObservationEvent {
    return input.source === "planet" ? this.planet.ingest(input) : this.sar.ingest(input);
  }

  replayFixture(
    input: SatelliteProofReplayFixture,
    governance: CanopyStateMachineGovernance = {},
  ): SatelliteProofPipelineResult {
    const fixture = satelliteProofReplayFixtureSchema.parse(input);
    const baseline = this.ingestBaseline(fixture.baseline);
    const observation = this.ingestObservation(fixture.observation);
    if (baseline.gridId !== observation.gridId) {
      throw new Error("Satellite proof replay rejected: baseline and observation gridId values differ.");
    }
    const audit = this.audit.ingest({
      ...fixture.audit,
      baselineRoot: baseline.baselineRoot,
      observationRoot: observation.observationRoot,
    });
    if (audit.gridId !== baseline.gridId) {
      throw new Error("Satellite proof replay rejected: audit and baseline gridId values differ.");
    }

    const events: CanopyEvent[] = [
      baselineSnapshotToCanopyEvent(baseline),
      observationToCanopyEvent(observation, baseline.baselineRoot),
    ];
    const vegetationGrowthEvent = vegetationGrowthToCanopyEvent(observation, baseline.baselineRoot);
    if (vegetationGrowthEvent) events.push(vegetationGrowthEvent);
    events.push(
      auditAttestationToCanopyEvent(audit),
      {
        id: `evt_certificate_issued_${audit.auditRoot.slice(0, 24)}`,
        type: "CertificateIssued",
        cellId: baseline.gridId,
        timestamp: fixture.certificate.timestamp,
        certificateId: fixture.certificate.certificateId,
        verifiedTco2e: fixture.certificate.verifiedTco2e,
        methodologyVersion: fixture.certificate.methodologyVersion,
        auditRoot: audit.auditRoot,
      },
    );
    if (fixture.unlock) {
      events.push({
        id: `evt_unlock_authorized_${fixture.unlock.unlockId}`,
        type: "UnlockAuthorized",
        cellId: baseline.gridId,
        timestamp: fixture.unlock.timestamp,
        unlockId: fixture.unlock.unlockId,
        certificateId: fixture.certificate.certificateId,
        token: fixture.unlock.token,
        amount: fixture.unlock.amount,
      });
    }

    const replay = replayCanopyEvents(events, governance);
    if (fixture.expectedRoots) {
      const actualRoots = {
        stateRoot: replay.state.stateRoot,
        certificateRoot: replay.state.certificateRoot,
        unlockRoot: replay.state.unlockRoot,
        challengeRoot: replay.state.challengeRoot,
      };
      if (
        actualRoots.stateRoot !== fixture.expectedRoots.stateRoot ||
        actualRoots.certificateRoot !== fixture.expectedRoots.certificateRoot ||
        actualRoots.unlockRoot !== fixture.expectedRoots.unlockRoot ||
        actualRoots.challengeRoot !== fixture.expectedRoots.challengeRoot
      ) {
        throw new Error("Satellite proof replay rejected: fixture expectedRoots do not match deterministic replay.");
      }
    }

    return {
      baseline,
      observation,
      audit,
      events,
      replay,
    };
  }
}
