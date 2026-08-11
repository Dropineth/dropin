# CanopyProof Governance Model

Status: Phase 1 design baseline

CanopyProof governance must be understandable to public institutions,
restoration organizations, NGOs, universities, and impact investors. Governance
is not token voting by default. It is role-bound, evidence-bound, auditable
decision making.

## Governance Layers

```text
Technical governance
  release approvals
  code review
  infrastructure change control

Evidence governance
  reviewer accreditation
  verification policy
  challenge resolution

Partner governance
  organization onboarding
  institution verification workflow
  data-sharing agreements
  suspension and appeals

Public accountability
  transparent records
  bounded claims
  published methodology
```

## Decision Types

- release approval.
- organization onboarding.
- organization document review and trust-level transitions.
- verifier accreditation.
- evidence acceptance policy.
- certificate issuance approval.
- certificate revocation.
- funding allocation approval.
- ESG report publication.
- early-warning public risk release.
- early-warning response playbook governance.
- methodology publication and deprecation.

## Implemented Governance Compatibility Slice

CanopyProof methodology versions are governed records. Draft methodology
versions remain restricted to institutional reviewer roles. Publishing requires
governance approval plus human-review, governance-approval, and public-challenge
quality gates. Published methodology records are append-only; material changes
must create a successor version rather than rewriting the rules that supported
older proof records.

CanopyProof quality scorecards are governed review inputs. They expose
deterministic `pass`, `needs_review`, or `blocked` findings for GPS accuracy,
duplicate risk, satellite contradiction, audit lineage, unresolved challenges,
and privacy redaction, but they cannot approve evidence, issue proof records, or
override human reviewers and governance bodies.

CanopyProof verification decision dossiers are the accountable human review
records that bind evidence, advisory AI analysis, TerraProof scenes, quality
scorecards, human-review work items, governance approvals, and audit roots. A
blocked quality gate cannot be approved through a dossier, and agent actors
cannot write one.

The current CanopyProof OS API exposes a first production-compatible governance
boundary under `/canopyproof/governance/*`.

```text
GET  /canopyproof/governance/status
GET  /canopyproof/governance/policies
POST /canopyproof/governance/approvals
GET  /canopyproof/governance/approvals
POST /canopyproof/governance/conflict-disclosures
GET  /canopyproof/governance/conflict-disclosures
```

Default policies:

- `canopyproof_policy_proof_record_issuance_v1`
- `canopyproof_policy_esg_publication_v1`
- `canopyproof_policy_funding_allocation_v1`
- `canopyproof_policy_public_risk_release_v1`
- `canopyproof_policy_risk_response_playbook_v1`
- `canopyproof_policy_partner_onboarding_v1`

Proof-record approvals bind to:

```text
proof_record:<projectId>:<hash(sorted evidenceIds)>
```

This subject ID is deterministic, so an approval is for the exact proof request,
not for a broad project or arbitrary future certificate.

Risk response playbook approvals bind to the exact playbook ID, for example:

```text
cp_risk_playbook_drought_field_response_v1
```

Approval of a playbook is approval of a bounded operational template only. It is
not an emergency declaration, certification, financial product approval, carbon
credit issuance, tax-offset claim, or yield promise.

Approval invariants:

- reviewer ID and reviewer role are derived from the origin-verified request
  principal, then matched to the current durable participant and exact active
  organization membership.
- final approval requires a verified organization and a latest approved
  accreditation whose status matches the organization registry summary.
- participant, membership, organization, or accreditation suspension/revocation
  takes precedence over an unexpired identity token on the next request.
- authority commands require hashed idempotency receipts and commit the semantic
  decision event with the governed row in one serializable transaction. A
  database or audit failure cannot produce a successful governance response.
- data-sharing agreement creation, revocation, renewal, and constrained
  supersession use the same durable command boundary. Prior versions remain
  visible and cannot be reactivated by deleting or rewriting lineage.
- data-access requests and decisions use the same durable command boundary.
  The request remains an immutable pending fact, while independent human
  decisions append explicit predecessor/next-state records. Approval neither
  delivers a dataset nor creates environmental proof or financial authority.
- audit export manifests are durable organization-governed hash indexes. Their
  creation records who assembled which classified and redacted resource roots;
  it does not constitute data delivery or waive request-time governance.
- data-access delivery receipts use the same durable command boundary but only
  register an immutable hash-only delivery fact. PostgreSQL independently
  requires a currently approved request, active agreement, live server-read
  manifest, classification-appropriate verified recipient, independent delivery
  actor, and exact semantic event. A later request or agreement revocation blocks
  future delivery without rewriting a receipt that was valid at its event time.
  Receipt registration is not evidence of data use, ecological proof, carbon
  certification, tax-offset eligibility, or financial entitlement.
- data-use attestations are durable human statements over an immutable delivery,
  not governance decisions. Recipient-authored `within_scope` assertions require
  live authority and output hashes; recipient `no_use` statements and
  evidence-bound institutional challenges remain recordable after authority is
  withdrawn. Contradictory statements are preserved for review. No attestation
  can approve itself, mutate access, settle enforcement, or create environmental
  proof or financial/carbon authority.
- data-use enforcement cases are durable, append-only independent human review
  dispositions over challenged attestations. The reviewer must be an active
  verified institutional owner/admin/verifier and must differ from the
  challenger, delivery recipient, and delivery actor. Reviews remain recordable
  after authority withdrawal, preserve all challenge roots, and may recommend
  suspension or revocation, but cannot apply an access restriction without the
  separate owner/admin approval path.
- data-access restrictions are a durable, append-only owner/admin decision
  stream separate from enforcement review. Every state transition consumes the
  exact prior restriction root, retains the enforcement evidence, and requires
  a verified human actor independent from the reviewer, attester, recipient,
  and deliverer. Restoration also requires a later resolved enforcement review
  and an actor distinct from the prior restriction approver. Expiry is a review
  deadline, never an automatic restoration. The latest replayed active state
  blocks future delivery and positive-use assertions without rewriting any
  historical request, delivery, use, or challenge fact.
- data-access accountability packets are durable hash-only snapshots generated
  by verified institutional humans. They freeze the exact event-ordered request,
  agreement transition, delivery, use, enforcement, and restriction lineage at
  one point in time. A packet may later become stale without becoming mutable or
  corrupt. Generation is not replay verification or publication authority;
  those remain separate human-governed workflows and fail closed until their
  durable adapters are complete.
- accountability replay verification is a durable, append-only comparison by a
  verified human member who differs from the packet generator. It independently
  proves packet creation-time integrity and then compares the current event-
  ordered ledger. A stale result is preserved as a challenge finding rather
  than rewriting the packet or prior clean verification. Verification remains
  separate from public publication and carries no final ecological, legal,
  carbon, tax, or financial authority.
- each approval references a policy ID.
- each policy defines subject types, required approval count, and allowed
  reviewer roles.
- only approved decisions satisfy proof issuance.
- unresolved conflict disclosures block validation.
- governance approvals append typed audit events.

## Required Roles

- Owner: controls organization policy and membership.
- Admin: manages organization-scoped operations.
- Verifier: reviews evidence and proof records.
- Researcher: accesses approved datasets and exports.
- Community: submits or challenges evidence.
- Observer: read-only institutional/public access.

## Institution Verification

Organization verification is part of governance, not marketing profile editing.

Workflow states:

- `pending`
- `document_review`
- `verified`
- `suspended`
- `revoked`

Rules:

- `document_review` requires at least one hash-bound institutional document.
- `verified` requires a registration number and at least one hash-bound
  institutional document.
- the current mounted compatibility API limits transitions to owner, admin, or
  verifier actors, but its mutable profile update is not canonical authority.
- the route-closed canonical authority records every lifecycle transition,
  document review, appeal, and appeal decision as an immutable fact in one
  organization event sequence.
- an accepted document review binds a hash-only registration reference;
  PostgreSQL recomputes it from the current registration number at review and
  final verification time, while the raw number remains outside the fact.
- subject owners/admins may anchor `pending`, submit hash-bound documents, and
  appeal. Document review, verification, suspension, revocation, appeal
  resolution, and reinstatement require current accredited humans from a
  different verified organization.
- the document reviewer cannot be the verification decider; the original
  governor cannot review the appeal; and the appeal reviewer cannot authorize
  reinstatement. Agents and AI cannot create any canonical fact in this
  authority.
- suspension can return to `verified` only after an upheld appeal with
  `reinstate` remedy and a separate human reinstatement fact.
- revoked organizations cannot be reactivated without a new institutional
  identity.

The authority is default closed. It has no mounted HTTP route, scheduler,
legacy-state import, session invalidation integration, or production
activation. Those require a separate migration and operator-approved review.

### Organization Accreditation Authority

The first accreditation decision cannot authorize itself. CanopyProof resolves
that circular dependency through a narrow root charter, not an administrator
flag. An initial charter requires at least three signed approvals from verified
humans in distinct verified organizations and delegates only accreditation
review, decision, and control. A successor requires both predecessor and
successor council quorums. Every charter expires within 366 days; suspension,
expiry, and terminal revocation never fall back to an older charter.

This protocol is implemented but no real ceremony has occurred. Council
identity review, public-key ceremony, conflicts, revocation operations,
external records, native database gates, and explicit activation remain human
governance obligations.

Canonical accreditation is a governed lifecycle, not a mutable badge:

1. A verified subject owner/admin submits one hash-bound scope and policy
   application with a bounded requested expiry.
2. A currently authorized human in another verified organization reviews it.
3. A different currently authorized external human approves or denies the
   exact reviewed application.
4. Approval is projected only for an explicit time inside a maximum 366-day
   interval. Expiry is derived and never rewrites history.
5. A scoped external governor may suspend or terminally revoke the latest
   approval. Renewal requires a new application, review, and decision.

Application, review, decision, and control facts form one append-only sequence
with deterministic roots and exact receipts. Subject self-accreditation,
reviewer self-approval, scope widening, older-approval fallback, Agent/AI final
authority, and post-revocation renewal fail closed.

This authority is route-closed. Its transaction-bound current-authority
resolver and signed root-governance protocol are implemented, but the real
ceremony, reviewed identity/key provisioning, compatibility classification,
invitation flow, notice delivery, session invalidation, native PostgreSQL
evidence, and least-privilege writer role remain separate approval gates.
Compatibility accreditation rows are not canonical input.

## Release Council

The existing Phase 16.9 release council artifact is a useful deployment gate.
The CanopyProof OS SQL contract now includes
`governance.release_council_reviews` so deployment-target approval evidence can
be stored as immutable records with target, 40-character target commit, workflow
context, reviewer, decision, rationale, conflict disclosure, review hash, and
audit root.

Production governance still needs to make these records operational:

- council member registry.
- reviewer eligibility.
- conflict disclosures.
- target artifact and commit binding.
- approval rationale.
- audit event.
- revocation and replacement process.

Release-council corrections must be new review records. Existing reviews are
append-only and must not be force-updated in place.

## Human Review

Human review is required for:

- settlement-grade evidence acceptance.
- Impact Certificate issuance.
- certificate revocation.
- high-value funding release.
- ESG report publication.
- AI-generated material used in public records.

The governance layer does not replace human review. It records institutional
approval after evidence validation, AI advisory analysis, and human review have
created their own lineage.

## Database Audit Checkpoints

Database audit checkpoints are governance evidence, not governance decisions.
They summarize a complete, contiguous row-scoped mutation stream and bind the
creator, terminal sequence, event roots, and creation time. Owner, admin,
verifier, researcher, and observer roles may independently replay supplied
hash-only streams; Agent actors cannot invoke the institutional verifier.
Checkpoint validity never approves proof, clears a conflict, certifies a carbon
credit, moves funds, creates a tax offset, or guarantees yield. A failed replay
must remain visible and be escalated as an integrity incident rather than
deleted or replaced.

## Challenge Process

Every public proof record must be challengeable.

Challenge records require:

- challenger identity.
- target object.
- reason.
- evidence.
- severity.
- bond or abuse-control policy if applicable.
- review decision.
- public outcome.
- audit trail.

Implemented challenge lanes:

- conflict disclosures for governance subjects.
- public challenge cases for issued Environmental Proof Records.
- institutional challenge cases for evidence, proof records, projects, quality
  scorecards, verification decisions, methodologies, Terra scenes, reporting
  packages, and funding allocations.

Opening a proof-record challenge immediately marks the public record as
`challenged` so downstream reports cannot present disputed records as clean
issued lineage. Accredited reviewers can resolve the challenge:

- accepted challenge: proof record becomes `revoked`.
- rejected challenge: proof record returns to `issued` only if no other open or
  accepted challenge remains.

Institutional challenge cases do not directly mutate the challenged subject.
They create a public, hash-bound dispute dossier with content-addressed
evidence references, related audit roots, assignment role, safety boundary, and
`challenge_case` audit history. Community actors can open cases, observers can
read them, and owner/admin/verifier/researcher actors can accept, reject,
withdraw, or request more evidence. Accepted cases become governance and
verification inputs; they are not carbon-credit, tax-offset, financial,
guaranteed-yield, mainnet-fund, or token-distribution authority.

Subjects with unresolved conflict disclosures cannot pass approval validation
until a future authorized review clears or waives the disclosure.

Independent audit attestations sit beside, not above, governance approvals.
They can confirm or qualify a bounded evidence/proof/reporting lineage from
source event roots and methodology, but they cannot override an unresolved
challenge, approve a proof record, issue a carbon credit, or move funds.

## Project Lifecycle Governance

Project registration, status transitions, and monitoring assertions use the
durable PostgreSQL trust command boundary. Registration is a `submitted`,
immutable organization-owned fact. Current status is replayed from append-only
status-transition and monitoring facts; no command rewrites the registration
row.

Project actors must be verified humans with an exact active membership in the
verified owning organization:

- registration and lifecycle transition: owner, admin, or verifier;
- monitoring assertion: owner, admin, verifier, or researcher;
- Agent identities have no project registration, transition, or final
  monitoring authority.

The finite state machine rejects skipped, backward, same-time, and post-archive
changes. Activation and explicit monitored transitions require a real approval
whose policy applies to the exact project. The approver must be a verified human
allowed by that policy and must differ from both the project creator and the
transition actor. Approvals cannot be introduced through challenge, suspension,
or archival transitions.

Each monitoring assertion must cite an existing, prior, same-project evidence
object or satellite observation. This validates lineage, not the truth of the
environmental claim: source evidence, methodology, verification, and challenge
authorities remain independently reviewable. The v1 `active` and `monitored`
states must never be represented directly as institutional `FUNDED`,
`VERIFIED`, or `LONG_TERM_OBSERVATION` states.

### Canonical Institutional Project Lifecycle

The separate route-closed project-lifecycle authority is the only implemented
path for the institutional stage names. It requires:

- an on-record verified human owner/admin proposer from the project
  organization; Agent preparation is advisory and off-record;
- one external verified human reviewer with current canonical
  `projects:lifecycle_review` accreditation;
- a transition/control governor who is external to the project organization
  and distinct from both proposer and reviewer, with current
  `projects:lifecycle_govern` accreditation;
- exact current-source re-resolution for funding, Environmental Proof, and
  post-verification monitoring inside every supported serializable write;
- explicit refusal of closure and restoration until independent governed
  closure-review and restoration-decision authorities exist; and
- one append-only semantic event, fact, receipt, predecessor and project
  sequence for every accepted command.

Challenge and suspension are adverse states, not annotations. They block later
stage transitions and do not expire into an older good state. Restoration must
bind the exact latest adverse control and come from a different human and
organization; revocation and closure are terminal. The authority has no mounted
route, scheduler, or production activation. Its route-closed resolver composes
project, current human actor, governed `project_lifecycle` policy, funding,
Environmental Proof, and monitoring authority from durable facts in the caller
transaction. No compatibility endpoint may claim or infer a canonical stage
from it.

## Evidence Registration Governance

An evidence registration is an immutable contributor assertion bound to the
current project root. Registration authority is limited to a verified human
with an exact active `owner`, `admin`, `verifier`, `researcher`, or `community`
membership in the verified owning organization. Agents cannot register human
field evidence. The project must not be archived, and neither project authority
fields nor contributor identity may be supplied as trusted client state.

Structural `validated` and `challenged` are deterministic ingestion outcomes,
not approval decisions. The reviewer set is empty at registration. AI analysis,
human review, challenge resolution, supersession, and final verification must be
separate future facts with their own actors, predecessor roots, and governance
checks. No registration can issue proof, certify a carbon credit, create a tax
offset or financial asset, guarantee yield, move mainnet funds, or distribute
CANOPY automatically.

## Partner Accountability Disclosure

Publishing a partner data-access accountability packet is a separate governance
action from generating or verifying it. The packet generator, replay verifier,
and owner/admin publisher must be three distinct actors. Publication requires a
valid replay that still matches the current append-only lineage; later changes
do not rewrite the disclosure and instead make its public read model `stale`.
The disclosure is a transparency record only and grants no data access, proof
authority, financial right, carbon credit, tax offset, or guaranteed yield.

This publication boundary is durable in PostgreSQL: actor membership, three
event boundaries, canonical hashes/roots, safety flags, and event payload are
database-verified. Public status, list, and get reads are hash-only, bounded,
and available without institutional identity. Production does not use a memory
fallback.

Authenticated human participants may challenge a disclosure using bounded
public text and evidence event roots. The challenger and original publisher
cannot resolve the challenge. A verified human owner, admin, or verifier with
active authority in the challenged organization may request more evidence,
dismiss the challenge, or uphold it; only a request for more evidence can be
followed by one successor resolution. AI may assist but cannot append a final
decision. An upheld challenge requires one of two later append-only public
actions:

- correction: link a current, uncontested replacement disclosure from the same
  organization;
- withdrawal: publish a non-reliance notice without deleting the original.

The notice publisher must be a verified human target-organization owner/admin
independent from the challenger, original publisher, and final reviewer. Public
read models prioritize open challenges and required remedies, then derive
`corrected` or `withdrawn` from event-ordered notices while retaining immutable
notice and replacement roots for replay.

Challenge and resolution creation plus public reads are durable. PostgreSQL verifies
the human challenger's active role in its own verified organization, binds the
challenge to the target disclosure stream, rejects private/secret statement
material, requires prior semantic evidence roots, and independently derives all
challenge hashes and event payloads. Resolution checks add target-organization
reviewer authority, challenger/publisher independence, one-root/one-successor/
one-final lineage, decision/remedy consistency, prior evidence roots, and exact
hash/root/event replay. Cross-organization challenge participation grants no
data access or target membership.

Correction, withdrawal, and notice publication are durable PostgreSQL governance
contracts. A correction replacement must be distinct, same-organization,
current, and uncontested at the notice's historical event boundary; later
challenges remain visible without rewriting that historical finding. A
withdrawal cannot name a replacement. Exact retries return the committed notice,
changed retries conflict, and update/delete attempts fail append-only guards.

## Evidence Verification Authority

Evidence verification follows separation of duties:

1. A versioned deterministic ruleset produces a validation fact. Its executor
   cannot shape the outcome.
2. A verified organization Agent may append provenance-bound analysis and
   findings. AI is advisory and has no approval capability.
3. An independent verified human reviews the exact latest validation and the
   complete AI analysis set. The evidence contributor and AI agents are
   conflicted actors for that review.
4. Approval requires an active verifier membership and current approved
   organization accreditation. Researchers may reject, challenge, or request
   changes, but cannot approve.
5. Every high or critical AI finding receives an explicit human disposition.
   Escalation blocks approval; accepted or overruled findings require rationale
   and prior semantic evidence roots.
6. New validation or AI facts reopen the reliance projection. Historical
   approvals remain visible but are no longer current.
7. Any verified human with an active owner/admin/verifier/researcher membership
   in a verified organization may commit a hash-rooted challenge. A challenger
   from another organization records standing only; it receives no target data
   access, membership, or decision authority.
8. An open or needs-more-evidence challenge suspends reliance immediately.
   Resolution belongs to an independent verifier/researcher in the evidence-
   owning organization; terminal upheld/dismissed decisions require current
   accredited verifier authority and cannot be authored by AI, the contributor,
   challenger, original reviewer, referenced AI agents, or a prior resolver.
9. Dismissal restores only the current underlying replay result. Upheld findings
   project `correction_required` until a separate independent owner/admin or
   accredited verifier appends a remedy.
10. Withdrawal preserves all facts and removes reliance. Supersession links a
    distinct same-project/same-organization replacement only after that
    replacement has independently reached current `approved` reliance. It does
    not copy review authority or rewrite either stream.
11. A final evidence decision is a second-human maker-checker fact over the
    exact current reliance, validation, complete AI set, human review, and
    predecessor event. Only a currently accredited human with the exact
    `verifier` role may append it.
12. The final verifier must be independent from the contributor, current human
    reviewer, current AI agents, every challenge/resolution/correction actor,
    and the prior final verifier. `verify` cannot promote anything except
    current `approved` reliance backed by human `approve`.
13. A final decision is current only while its event remains terminal. Any later
    evidence-stream fact makes it `stale`; a successor requires an intervening
    authority fact and verifier rotation. Internal `verified` is not proof
    issuance or an environmental, carbon, tax, asset, funding, or yield claim.
14. An Environmental Proof candidate is a deterministic, immutable authority
    bundle over the current eligible project, governed methodology publication,
    current proof policy, current verified final evidence decisions, and
    accepted post-decision monitoring. Caller-supplied roots or authority
    snapshots have no standing.
15. Candidate approval requires at least two unique independent verified humans,
    including an accredited verifier and an owner/admin. Source actors, the
    candidate deriver, Agent identities, duplicate reviewers, and stale-policy
    approvals are ineligible.
16. Record issuance requires the complete all-approve candidate quorum and a
    separate independent owner/admin issuer. Later source facts make the current
    projection stale; they never rewrite or delete the issued fact.

Operational queues schedule work but carry no verification authority. Legacy
decision-dossier and generalized challenge services, plus legacy proof,
public-record, and certificate routes, remain closed
in enforced mode until their durable governance facts reference this authority
without process-memory fallback.

### Governed ESG Metrics And Canonical Reports

The route-closed ESG authority applies maker-checker governance to both metric
meaning and metric values:

1. A metric definition is organization-owned, immutable, versioned, and bound
   to a current governed methodology publication. Publication requires two
   unique eligible human reviewers, including verifier and research competence;
   the publisher cannot satisfy its own review quorum.
2. A metric result is bound to one current definition version and the complete
   current Environmental Proof/MRV/signed-lifecycle source set. The calculator
   and reviewer must be distinct eligible humans with explicit
   `esg_metric:calculate` and `esg_metric:review` accreditation.
3. Exact decimal value, missing-value semantics, unit, precision, uncertainty,
   periods, calculation artifact, limitations, and source-member roots are
   governed facts. A reviewer cannot silently convert unavailable data to zero
   or change units, precision, source membership, or uncertainty.
4. Canonical report publication requires an accredited human with
   `esg_reporting:publish`, at least one current signed Environmental Proof
   source, and at least one current independently reviewed metric result.
   Source and metric members are committed into the report root and every
   framework disclosure.
5. AI and Agent identities may assist calculation or narrative preparation but
   cannot review a metric, publish a definition, publish a canonical report, or
   authorize institutional reliance.
6. Source challenge, revocation, lifecycle expiry, methodology supersession,
   definition supersession, missing source, or forged projection propagates to
   metric and report projections. Historical facts remain immutable; correction
   requires a successor result/report rather than mutation.
7. The institutional source adapter accepts only a root-valid `current`
   projection with complete source and metric lineage. Even then,
   `institutionalRelianceAuthorized` remains false pending external framework,
   legal, privacy, operations, and governance approval.

No canonical ESG HTTP route is mounted. The process-local compatibility report
routes are not a substitute authority and cannot be promoted through a feature
flag alone.

## Public Transparency Governance

Canonical disclosure uses two-person separation of duties. A verified human
`verifier` or `researcher` with approved
`public_transparency:privacy_review` scope reviews the exact allowlist. A
different verified human `owner` or `admin` with approved
`public_transparency:publish` scope publishes it. Neither actor may be the
Environmental Proof issuer or contributor; the publisher may not be the
reviewer. Agents and AI have no final disclosure authority.

Sensitive reviews always withhold location. Restricted reviews withhold both
location and area. Later challenges and lifecycle controls are projected
publicly without exposing private challenge material. Relaxing a prior review
requires a new review and publication; no fact is updated or deleted. The
authority remains route-closed and `publicRelianceAuthorized=false` pending
privacy, safeguarding, legal, production database operations, accessibility,
and governance approval.

## Public Claims Policy

Approved language:

- Environmental Proof Record.
- impact evidence.
- restoration accountability.
- estimated carbon impact.
- public-interest environmental records.

Blocked language unless a future licensed workflow exists:

- certified carbon credit.
- carbon-tax offset.
- guaranteed yield.
- automatic CANOPY distribution.
- live mainnet fund movement.
