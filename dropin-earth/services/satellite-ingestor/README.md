# CanopyProof three-layer satellite proof pipeline

This workspace is a deterministic, fixture-only integration boundary. It does not call Sentinel, Landsat, Planet,
ICEYE, Capella, Maxar, Airbus, drone, or field-validator services. The checked-in replay fixture is engineering test
data and is the only supported input class in this phase.

## Layers

1. **Baseline** normalizes Sentinel-1, Sentinel-2, or Landsat measurements into an immutable
   `BaselineSnapshot`. Its domain-separated SHA-256 `baselineRoot` binds the grid, timestamp, source, canopy
   cover, NDVI, and SAR values.
2. **Observation** normalizes Planet, ICEYE, or Capella measurements into an `ObservationEvent`. High-confidence
   `deforestation`, `fire_risk`, and `survival_drop` events open a deterministic `ChallengeOpened` state.
3. **Audit** normalizes Maxar, Airbus, drone, or field-validator review into an `AuditAttestation`. The
   `auditRoot` binds the matching baseline and observation roots, verified metrics, auditor identity, and supplied
   fixture signature.

The records are converted into `BaselineAnchored`, `ObservationEvent`, and `AuditAttested` events and replayed
through `@dropin/dropin-protocol`; there is no parallel certificate path.

```text
BaselineAnchored
  -> ObservationEvent
     -> ChallengeOpened (derived for qualifying anomalies)
  -> AuditAttested
  -> CertificateIssued
  -> UnlockAuthorized (governance-gated)
```

`CertificateIssued` requires all three linked records and no unresolved challenge. `UnlockAuthorized` additionally
requires an issued certificate and an explicit `CANOPY_PRODUCTION_UNLOCK=true` governance decision. The default is
fail-closed. A high-confidence `deforestation`, `fire_risk`, or `survival_drop` observation produces a domain-separated,
first-class `ChallengeOpened` event. That event is applied to the event stream and can be persisted and replayed
without changing `stateRoot` or `challengeRoot`.

## Deterministic roots

Roots use SHA-256 over recursively key-sorted JSON with explicit domain separators:

- `canopyproof/satellite/baseline/v1`
- `canopyproof/satellite/observation/v1`
- `canopyproof/satellite/audit/v1`
- `canopyproof/satellite/challenge/v1`

The aggregate state machine exposes `stateRoot`, `certificateRoot`, `unlockRoot`, and `challengeRoot`. The replay
fixture at `tests/fixtures/canopyproof-satellite-proof-replay.json` pins all four values so a serialization or transition
change fails visibly.

## API boundary

`/canopyproof/satellite/status` reports the mock-only gate. `/canopyproof/satellite/replay` is authenticated and
RBAC-protected, executes only deterministic fixture replay, and always reports `productionWritePerformed: false`.
Neither endpoint calls a provider or writes a certificate/unlock record. The protocol itself rejects
`UnlockAuthorized` unless governance passes `CANOPY_PRODUCTION_UNLOCK: true`.

## Safety boundary

These fixtures are engineering test data, not live remote-sensing products, verified environmental proof,
certified carbon credits, financial assets, or production claims. `auditorSignature` is an opaque mock fixture value;
this phase binds it into `auditRoot` but does not claim to verify a provider or auditor signature. Adapter replacement
with real providers requires separate licensing, credential, provenance, signature-verification, data-quality,
availability, and governance reviews.
