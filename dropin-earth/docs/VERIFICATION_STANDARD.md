# CanopyProof Verification Standard

Status: DRAFT - NON-PRODUCTION

Version: 0.1

Date: 2026-07-13

## 1. Scope

This standard governs how CanopyProof evaluates evidence and creates a bounded,
human-accountable verification decision. It applies to field, mobile, drone,
satellite, IoT, community, visual, point-cloud, document, and partner evidence.

Verification is not carbon-credit certification, a tax-offset decision, a
financial assurance opinion, or a guarantee of ecological outcome.

## 2. Authority Principle

AI is advisory and can never be final authority.

A final decision requires an authenticated, currently eligible human reviewer.
High-risk or public-reliance decisions require a second independent reviewer or
governance approval according to the active proof policy.

The evidence contributor, model operator, first reviewer, final reviewer,
challenge resolver, and certificate approver must satisfy the configured
separation-of-duty rules.

## 3. Pipeline

```text
registered evidence
  -> structural validation
  -> rule evaluation
  -> advisory AI analysis
  -> TerraProof or source cross-check where applicable
  -> human review
  -> independent final decision
  -> monitoring
  -> challenge, correction or supersession when required
```

Each stage appends an immutable fact and audit event. Skipping a required stage
is a verification bypass and must be rejected by both service and database
constraints.

## 4. Evidence Preconditions

Evidence may enter verification only when it has:

- immutable evidence identifier and project binding;
- contributor and organization authority at submission time;
- source type and acquisition timestamp;
- media and metadata commitments where applicable;
- custody and consent state required by policy;
- device attestation state where required;
- normalized location precision and sensitivity class;
- duplicate and replay assessment;
- applicable license and use permission;
- methodology and policy version; and
- an audit root with no detected integrity break.

Missing data remains explicit. It must not be replaced with zero, inferred
precision, default coordinates, or a positive status.

## 5. Lifecycle

The canonical verification projection supports:

- `CREATED`
- `SUBMITTED`
- `VALIDATING`
- `REVIEW`
- `VERIFIED`
- `MONITORED`
- `CHALLENGED`
- `REJECTED`

Compatibility statuses map through a versioned translation table. Mapping must
not turn a weaker state into `VERIFIED`.

Lifecycle transitions are immutable facts. Corrections and challenge outcomes
supersede projections but never rewrite prior decisions.

## 6. Structural Validation

Validation is deterministic and records:

- ruleset identifier and version;
- normalized input root;
- pass, fail and unavailable checks;
- duplicate, timestamp, location, device, identity and custody signals;
- data-quality issues;
- execution timestamp and software version; and
- result and audit roots.

A validation pass means only that configured structural rules passed. It is not
proof or ecological confirmation.

## 7. Advisory AI Analysis

Every AI analysis records:

- model definition and immutable artifact digest;
- prompt or inference-policy digest where applicable;
- calibration and evaluation dataset references;
- supported sensor, resolution, altitude, season, ecosystem and geography;
- input and output roots;
- candidate findings, confidence and uncertainty;
- known limitations and domain gaps;
- execution environment and timestamp; and
- an explicit `advisory_only` authority marker.

An analysis is blocked when applicability is not established. Examples include
RGB-to-thermal substitution, unvalidated altitude transfer, vineyard-to-forest
transfer, local-to-absolute CRS comparison without registration, and
uncalibrated RGB used as reflectance evidence.

Scores and embeddings rank review work. They do not establish truth.

## 8. Human Review

A human review records:

- reviewer identity, organization, role and accreditation snapshot;
- conflict disclosure and independence determination;
- evidence, validation and AI roots reviewed;
- methodology and policy versions;
- observations and bounded rationale;
- decision recommendation;
- uncertainty and unresolved issues;
- timestamp, signature reference and audit root.

Reviewers must see provenance, limitations, counter-evidence, known decoys and
uncertainty. Interfaces must not present model confidence as an authoritative
answer.

## 9. Final Decision

A final decision contains:

- `decision`: `VERIFY`, `REJECT`, `REQUIRE_MORE_EVIDENCE`, or `INCONCLUSIVE`;
- verification score and its method;
- risk score and its method;
- confidence and uncertainty bounds;
- deciding reviewer and eligibility snapshot;
- prior independent reviews;
- decision reason;
- policy, methodology and evidence roots;
- decision, event and audit roots; and
- monitoring or re-verification deadline.

Only `VERIFY` projects evidence to `VERIFIED`. `INCONCLUSIVE` is not a soft
approval. An unavailable dependency cannot default to `VERIFY`.

## 10. Scoring Rules

Scores are explanatory attributes, not authority. Every score must declare:

- scale and direction;
- calculation version;
- source features and missingness;
- calibration population;
- uncertainty;
- threshold owner and approval; and
- known failure modes.

No weighted average may erase a critical failed check. Policy defines
non-compensable conditions such as broken custody, revoked consent, unlicensed
use, mismatched project, ineligible reviewer, or integrity failure.

## 11. Field Verification

Field checks use generalized locations where safety requires. A result records
GPS, time, media commitments, notes, device attestation, reviewer, result,
custody and audit root.

Allowed results are:

- `CONFIRMED`
- `REJECTED_FALSE_POSITIVE`
- `NOT_FOUND`
- `INACCESSIBLE`
- `INCONCLUSIVE`

`CONFIRMED` without required device attestation is invalid. Field confirmation
still requires the governed final-decision pipeline.

## 12. Monitoring And Freshness

Verification is time-bounded. Methodology defines:

- observation window;
- maximum evidence age;
- biome and seasonal constraints;
- monitoring frequency;
- material-change triggers;
- staleness behavior; and
- required re-verification.

Expired or stale verification cannot support a current public record.

## 13. Challenge, Correction And Supersession

Authorized challenges append a challenge fact, risk fact and governance review.
The challenged projection remains visible. Resolution requires independent
review and cannot delete the original decision.

Corrections reference the superseded decision, describe the defect, bind new
evidence and produce a new root. Upheld challenges can suspend or revoke a
dependent Environmental Proof Record without rewriting issuance history.

## 14. Failure Semantics

The pipeline fails closed on:

- unavailable authorization or policy authority;
- missing required source or custody data;
- model-domain mismatch;
- reviewer conflict or ineligibility;
- broken hash, sequence or audit chain;
- duplicate final decisions;
- stale methodology or accreditation;
- transaction or event-write failure; and
- unknown lifecycle transitions.

Retries use the same idempotency key and normalized command hash.

## 15. Metrics

Required low-cardinality metrics include:

- evidence submitted and structurally rejected;
- validation completed and failed;
- advisory analyses completed and domain-blocked;
- human reviews and median review time;
- reviewer disagreement;
- final decisions by bounded outcome;
- field checks and confirmation rate;
- challenges, corrections and reversals;
- queue age, retry and dead-letter counts; and
- verification staleness and re-verification backlog.

Metrics must not contain personal data, precise protected locations, evidence
hashes, unbounded project IDs or free-text rationales.

## 16. Required Tests

Conformance tests must prove:

- machine output cannot become verified evidence;
- AI and agents cannot issue certificates;
- human review and required independence cannot be bypassed;
- revoked or suspended authority is rejected;
- duplicate and conflicting final decisions are rejected;
- broken custody, consent, license and audit roots fail closed;
- sensor and CRS domain mismatches are rejected;
- field confirmation requires device attestation;
- challenges preserve prior decisions and create risk/governance facts;
- retry is idempotent under concurrent native PostgreSQL connections; and
- replay produces the same projection after restart.

## 17. Current Boundary

Typed services and PostgreSQL constraints implement substantial portions of
this standard, and unit/PGlite tests are green. Production conformance is not
established until the native concurrency gate, durable worker runtime, real
provider integrations, reviewer operations, independent security review and
separately governed route opening are complete.
