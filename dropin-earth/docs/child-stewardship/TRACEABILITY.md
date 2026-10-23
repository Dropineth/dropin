# Child stewardship requirement and acceptance traceability

Updated 2026-10-23 against the restored specification SHA-256
`d7bca48c07c7a04ce12efb5a8f33604b6b86cc69d7fffd9abf13f98ef8a8f503`.
The private source remains outside this repository. See [BASELINE.md](./BASELINE.md)
for scope and limitations and [BUILD.md](./BUILD.md) for build evidence.

**No row means full product, pilot, provider, or production acceptance.**
“Local coverage” means executable code and relevant local tests exist for a
synthetic subset. “Unavailable” means the UI/API must say so and the real
capability remains closed. “Pending” means the listed acceptance work still
needs evidence. Normalized PostgreSQL authority and separate exact-transition verifier admission
are exercised by native tests; their final receipt is recorded in IMPLEMENTATION.md.
Initial snapshot SQL results are not attributed to this model.

## File and evidence keys

All links are relative to this directory. Keys in the matrices resolve here.

| Key | Implementation / evidence |
| --- | --- |
| L | [learning.ts](../../services/api/src/domain/child-stewardship/learning.ts), [learning-types.ts](../../services/api/src/domain/child-stewardship/learning-types.ts) |
| A | [agent-gateway.ts](../../services/api/src/domain/child-stewardship/agent-gateway.ts) |
| R | [authorization.ts](../../services/api/src/domain/child-stewardship/authorization.ts), [rights.ts](../../services/api/src/domain/child-stewardship/rights.ts), [rights-types.ts](../../services/api/src/domain/child-stewardship/rights-types.ts) |
| S | [signature.ts](../../services/api/src/domain/child-stewardship/signature.ts) |
| B | [runtime-boundary.ts](../../services/api/src/domain/child-stewardship/runtime-boundary.ts), [external-rights.ts](../../services/api/src/domain/child-stewardship/external-rights.ts), [app.ts](../../services/api/src/app.ts) |
| API | [child routes](../../services/api/src/routes/child-stewardship/index.ts), [store contract/test store](../../services/api/src/domain/child-stewardship/store.ts) |
| DB | [PostgreSQL store](../../services/api/src/domain/child-stewardship/postgres-store.ts), [learning migration](../../services/api/prisma/child-stewardship.sql), [learning rollback](../../services/api/prisma/child-stewardship.rollback.sql), [rights authority migration](../../services/api/prisma/child-stewardship-authority.sql), [rights authority rollback](../../services/api/prisma/child-stewardship-authority.rollback.sql); separate exact-transition verifier and native authority tests |
| UI | [experience](../../apps/web/src/components/child-stewardship/StewardshipExperience.tsx), [screen catalogue](../../apps/web/src/lib/child-stewardship-screens.ts), [route](../../apps/web/src/app/stewardship/page.tsx) |
| O | [offline vault/sync](../../apps/web/src/lib/child-stewardship-offline.ts), [API client](../../apps/web/src/lib/child-stewardship-api.ts) |
| TL | [learning/gateway tests](../../tests/unit/child-stewardship-learning.test.ts): 24 passing in recorded local run |
| TR | [rights tests](../../tests/unit/child-stewardship-rights.test.ts), [synthetic fixtures](../../tests/fixtures/child-stewardship-rights.ts): 34 passing in recorded local run |
| TS | [signature tests](../../tests/unit/child-stewardship-signature.test.ts): nine passing in original primitive receipt; later integration is separate |
| TA | [actual Hono API tests](../../tests/unit/child-stewardship-api.test.ts): seven passing with `TestChildStore`; not native DB acceptance |
| TO | [offline tests](../../tests/unit/child-stewardship-offline.test.ts): 18 passing, including five actual Hono/domain race/replay cases with `TestChildStore` |
| TD | [native SQL contract test](../../tests/integration/child-stewardship-sql.integration.ts), [authority regressions](../../tests/integration/child-stewardship-authority.integration.ts), [actual store/Hono tests](../../tests/integration/child-stewardship-postgres.integration.ts): 23/23 final native passes: real PostgreSQL constraints, forged/delta admission denial, concurrency, rollback, token immutability and current consent; production acceptance separate |
| TB | [browser integration](../../tests/browser/child-stewardship.spec.ts): local preinstalled Chromium diagnostic PASS across all 35 screens using actual Hono/domain and `TestChildStore`, including localStorage-failure reload denial; not three-engine or native-DB acceptance |
| DEP | [dependency regressions](../../tests/unit/child-stewardship-dependencies.test.ts), [build record](./BUILD.md) |

Counts are evidence snapshots, not a final release total. Each test must be
rerun after relevant changes. Browser fixture coverage is distinct from a
Next/OpenNext/workerd sealed artifact. Test IDs in names do not imply that all
assertions in the corresponding specification contract were exercised.

Local receipts are kept outside the repository: `build/child-learning-unit.tap`,
`rights-kernel-tests.tap`, `build/child-api-tests.log`,
`build/child-native-final-combined.tap`, `child-ui/offline-tests.tap`, and
`child-ui/chromium-diagnostic.jsonl` under the task's audit-report directory.
The Chromium receipt records two identical observation submissions but one
stored observation, no unauthorized post-withdrawal submissions, no third-party
requests, and no page errors. Firefox/WebKit, controlled low-bandwidth tests,
human accessibility and provider acceptance remain unrun.

## Product requirements

| ID | Requirement boundary | Code/tests | Current coverage and remaining acceptance |
| --- | --- | --- | --- |
| GOV-001 | Server-owned mode and synthetic isolation | B, API, TA, UI | Local rejection paths and visible labels; deployed egress/credential isolation pending |
| GOV-002 | Region admission | L, B, TL | Real registration unavailable everywhere; approved regional policy/admission not implemented |
| GOV-003 | Versioned policy/decision/release evidence | L, R, BASELINE, BUILD | Synthetic policy versions; qualified approvals and final release manifest pending |
| ID-001 | Passkey, recovery, device revocation | L, R, TL, TR, S02/S27 | Demo token/device epochs and synthetic rights recovery; real WebAuthn and identity recovery unavailable |
| ID-002 | Separate guardian consent and child assent | L, O, TL, TA, TO | Local/API flows covered; real guardianship and child comprehension acceptance pending |
| ID-003 | Minimal age/region data | L, TL, UI | Fixed age bands and synthetic jurisdiction; lawful age assurance unavailable |
| ID-004 | No biometric collection | L, O, B, TL, TA, TO | Closed schemas reject extra fields; no camera/biometric feature; full deployed network/storage audit pending |
| ID-005 | Scoped current authorization/revocation without rights forfeiture | L, A, R, O, TL, TR, TO | Synthetic current-state/epoch/ancestor checks; real provider revocation and independent legal bases pending |
| UX-001 | Understandable, optional inputs and exit | UI, O, TB | Text choices, no media permissions, stop/help; child/low-literacy acceptance pending |
| UX-002 | No coercive engagement or financial incentives | UI, TL, TB | No streaks, rankings or tradable rewards; independent child-centered content review pending |
| UX-003 | Accessible stop/help and safe tasks | UI, L, TL, TB | Indoor-only synthetic tasks and one-step stop/help; real protection/field operations unavailable |
| UX-004 | Accessible, multilingual, low-bandwidth alternatives | UI, O, TO, TB | Keyboard/text/encrypted offline code; multilingual voice, human WCAG and controlled weak-network acceptance pending |
| TREE-001 | Stable tree/slot and stewardship distinction | L, TL, UI | Replacement preserves original tree; real registration/permission verification unavailable |
| TREE-002 | Precise-location isolation | L, UI, TL | Only fixed coarse synthetic region exists; real spatial disclosure testing pending |
| TREE-003 | Time-bounded ecological knowledge | L, TL, UI | Synthetic E0 remains unknown and expires; real method-specific freshness policies unavailable |
| TASK-001 | Approved safe task with eligibility/expiry | L, TL, UI | Indoor task, age/consent/expiry checks; real forestry/SOP/supervision acceptance pending |
| TASK-002 | Remote/equivalent participation | UI, L, TB | Camera-free indoor path; real accessibility/equity research pending |
| EV-001 | Conversation cannot confirm survival/carbon | A, L, TL, UI | Static proposal-only responses and E0; live-model regression/provider acceptance unavailable |
| EV-002 | Provenance, capture/receipt distinction, review lineage | L, A, TL, TA | Synthetic source, unverified claimed capture time, server receipt, digests; real media provenance unavailable |
| EV-003 | Duplicates/conflicts/unknown/manual appeal | L, TL, TA | Exact sample duplicate and independent dispute handling; crop/perceptual/media forgery checks unavailable |
| EV-004 | Append-only corrections and controlled deletion | L, TL, DB | Review/contribution correction lineage; complete deletion pipeline and DB authority acceptance pending |
| AG-001 | Versioned gateway, no model authority | A, TL, B | Static adapter has no arbitrary tools/ledger calls; actual live model or official protocol integration unavailable |
| AG-002 | Five verbs and reject unknown versions | A, TL | Local product-contract tests; no claim of official AHIN interoperability |
| AG-003 | Sources, limits, policy, no raw reasoning trace | A, UI, TL | Approved static summaries with sources/limits; no live chain-of-thought or model service |
| AG-004 | Injection/tool/secret/unsafe instruction boundary | A, B, TL, UI | Closed question and tool schema; live-media/model red-team acceptance pending |
| SYNC-001 | Encrypted drafts and current authorization | O, L, TO, TA | AES-GCM, epoch/profile binding, pre-byte denial/abort; restoration deliberately fail-closed without durable binding |
| SYNC-002 | Stable idempotency and explicit conflicts | O, API, L, TO, TA, TD | Local actual-route retries; native normalized concurrency/rollback covered; production adapter deployment acceptance pending |
| REW-001 | Nontransferable educational feedback | L, TL, UI | EDU_FEEDBACK has no cash/transfer API and cannot replace R/F |
| REW-002 | Reviewed grant, caps and deduplication | L, R, TL, TR | Canonical activity/outcome keys and synthetic limits; session sandbox scope, not real person dedupe |
| REW-003 | Corrections without shame/debt | L, TL, UI | Original records retained, zero-value correction, no tree-death penalty; child content acceptance pending |
| CAR-001 | Four independent logical ledgers | L, R, TL, TR, DB | Typed E/C/R/F and separate transitions; normalized relational authority/native integration covered; production acceptance pending |
| CAR-002 | Registry/serial/right-chain verification | B, R, S29 | External carbon verifier unavailable; no live registry or serial-overlap acceptance |
| CAR-003 | Real value remains closed without gates | B, API, TA, TS | Throwing adapters and route isolation; real G4 evidence absent |
| SAFE-001 | No strangers/search/public child location | UI, B, TA | No social/contact/location capability in slice; full production route/egress regression pending |
| SAFE-002 | Media protection before release | B, O, TA, TO, S12/S13 | Real media refused entirely; actual sanitizer/quarantine/human review unavailable |
| SAFE-003 | Staffed confidential reporting, no AI closure | L, TL, TA, UI | Synthetic report/recusal exercise only; real reporting explicitly unavailable |
| PRIV-001 | Purpose minimization/retention/no training | L, O, A, TL, TO | No raw media/free text/live model; real retention schedule/processor controls pending |
| PRIV-002 | Withdrawal/export/deletion with evidence | L, O, TL, TO | Immediate stop and local vault purge; server requests remain pending, not completed deletion |
| OPS-001 | Audit, limits, rollback/observability | API, DB, TA, TD, BUILD | Local minimal audit, in-process rate limits, outbox; durable distributed limits/alerts/restore operations pending |
| OPS-002 | Synthetic fixtures and no secrets/child data | All fixture/schema tests, BUILD | Generated ephemeral test keys and fixed samples; final artifact/log scanning still a release check |
| RIGHT-001 | Contributor/operator/beneficiary separation | L, R, TL, TR | Synthetic observer/enteredBy and immutable beneficiary paths; real identity binding absent |
| RIGHT-002 | Existing rights survive exit/death/policy | R, L, TR | Synthetic obligations preserved; real contractual/legal continuity requires institutions |
| RIGHT-003 | Operation-specific independent approvals | R, S, TR, TA | Actual approving V2 subset/control-domain tests; real-world independence facts not proven |
| RIGHT-004 | Bind exact operation semantics | R, S, TR, TA | Amount/currency/fee/destination/policy/environment/version/epoch tampering covered |
| RIGHT-005 | Policy-independent economic identity | L, R, TL, TR | Canonical keys and aliases within synthetic authority; new real-project global identity not asserted |
| RIGHT-006 | Orthogonal obligation/funding/payment status | R, TR, S31/S32 | Synthetic unfunded debt, reserved funds, submitted/confirmed status; real receipts unavailable |
| RIGHT-007 | Integer conservation/atomic limits/unknown payments | R, TR, DB | Pure transitions and native conserved exact-delta admission; institution consistency unaccepted |
| RIGHT-008 | No administrator/module/manual-bank bypass | B, R, TA, TR | Closed software routes; DB/KMS/bank institutional enforcement not established |
| RIGHT-009 | Scoped pause and independent relief | L, R, TL, TR, UI | Synthetic cases retain obligations and timestamps; real alternate responders/exit agreements absent |
| RIGHT-010 | Recovery/guardian/capacity continuity | R, TR, L | Synthetic authority transitions and old epoch rejection; no actual credential/guardian verification |
| RIGHT-011 | Legal/institution/funding gates for real adapter | B, R, TS, TA | Real adapter unavailable; no flag can supply missing provider acceptance |
| RIGHT-012 | Protect complaint metadata across channels | L, TL, TA | Guardian views/revisions/POST dedup probes covered; real email/helpdesk/backup/disclosure channels unavailable |

## Technical acceptance AT-01–AT-24

| ID | Local code/tests | Remaining contract coverage |
| --- | --- | --- |
| AT-01 | B/API/TA, UI/TB synthetic runtime rejection | Deployed credential and egress verification |
| AT-02 | L/TL consent, age bands, policy and closed real enrollment | Jurisdiction-specific admission and real age assurance |
| AT-03 | L/TL, R/TR revoked device/epoch | Real Passkey challenge/origin/RP/UV and session recovery tests |
| AT-04 | R/TR recovery; UI S27 unavailable label | Real recovery, safe notifications and verified representative process |
| AT-05 | L/O/TL/TO/TA withdrawal and pending privacy status | Downstream workers/processors, retained/legal-purpose inventory |
| AT-06 | O/TO pre-byte withdrawal, A/TL ancestor revocation | Actual media gateway and persisted official-protocol delegation lifecycle |
| AT-07 | UI/L/TL/TB indoor task and stop/help | Child comprehension and real field safety acceptance |
| AT-08 | UI/TB camera-free/keyboard path | Human screen reader, disability, low-literacy and multilingual acceptance |
| AT-09 | O/TO/TB vault reopen, account isolation, replay | Controlled 400 kbps/400 ms tests, crash/power-loss coverage and three engines |
| AT-10 | L/TL tree/slot replacement and fixed coarse region | Real spatial authorization and cross-tenant location leakage tests |
| AT-11 | L/A/TL/TA unknown synthetic E0; expiry | Real observation/method freshness and live-model hallucination regression |
| AT-12 | L/TL exact sample repeat and claimed-time honesty | Crop/transform duplicate detection, real media falsification and collision review |
| AT-13 | L/TL/TA disputes, grant/correction lineage and domain recusal | Real independent panel/case handling and deletion governance |
| AT-14 | A/TL all five verbs and unsupported algorithms | Official AHIN schema/version/test vectors and interoperable deployment |
| AT-15 | A/TL closed prompts/tools | Actual media/OCR and live-model red-team corpus |
| AT-16 | L/API/O/TL/TA/TO retries, canonical grants; initial TD | Native normalized DB concurrency/receipt-boundary rollback covered; production consumer crash acceptance pending |
| AT-17 | L/R/TL/TR EDU versus R/F rejection | DB write-scope/exact verifier-admission negatives covered; complete deployed cross-domain call graph pending |
| AT-18 | UI/L/TB no competitive or financial rewards | Child/family accessibility/equity and content acceptance |
| AT-19 | B/R/TS/TR closed external carbon path/type distinction | Registry authority/serial uniqueness/external proof verification |
| AT-20 | L/O/API/TL/TO/TA closed input and scoped outputs | Whole deployed log/object/index/backup/artifact scan and real media protections |
| AT-21 | UI/A/L/TL static safety/report limitations | Named staffed real protection pathway and live-model escalation |
| AT-22 | O/TO local purge; L/TL pending server requests | Full source/derivative/index/cache/export/processor/backup deletion proof |
| AT-23 | API/L/TA/TL audit, denial and local rate limits | Distributed limits, alerts, full fault-injection and access auditing |
| AT-24 | BUILD; baseline and rollback SQL | Final immutable SHA, independent signoffs, sealed artifact, restore/rollback and release evidence |

## Rights acceptance RT-01–RT-12

| ID | Local code/tests | Remaining contract coverage |
| --- | --- | --- |
| RT-01 | R/S/TR/TA missing roles, duplicates, expiry, conflicts, AI exclusion | Institution identity and independently verified control-domain registration |
| RT-02 | R/S/TR/TA exact bytes and cross-environment replay | Institution-side envelope validation and displayed human authorization |
| RT-03 | R/A/TR/TL bounded ancestors, revoke/epoch/cumulative use | Native DB concurrent delegation/rolling-limit and external queue checks |
| RT-04 | R/TR randomized synthetic settle/refund, integer rounding | Full accounting property corpus across authoritative DB/receipts |
| RT-05 | R/TR unknown payment/reservation; API/TA serialization | Every crash boundary in actual outbox/provider dispatch/reconciliation |
| RT-06 | R/TR future policy cannot rewrite vested terms | Cloud/KMS/module/batch/manual-bank enforcement and real contracts |
| RT-07 | R/TR actual approving external V2/control-domain dedup | Hidden ownership, coercion and collusion are external trust risks |
| RT-08 | L/R/TL/TR protected report and rights preservation | Disability/nonstandard family/coercion handling and real safety operations |
| RT-09 | R/TR recovery, guardian/capacity changes | Real proof verification, safe channels, alternate institution exit exercise |
| RT-10 | L/O/TL/TA/TO scoped view/vault and injection refusal | Real dataset linking attacks, support/export/processor/backup disclosure review |
| RT-11 | R/TR checkpoint/old-backup rejection | Actual restoration with independent executed/revoked/deleted checkpoints |
| RT-12 | R/TR conserved restricted legal correction | Legal decision provenance, parallel native DB correction and real institution acceptance |

## Attack/failure contracts EX-01–EX-33

| ID | Local evidence mapping | Scope and missing evidence |
| --- | --- | --- |
| EX-01 | B/API/TA denies legacy routes for child/guardian/service/admin claims | Dedicated synthetic mode only; live deployment and credential/egress proof pending |
| EX-02 | B/R/TS real adapter unavailable; current signed policy checks in TR | Full live gate-evidence packages unavailable; no flag-based enablement implemented |
| EX-03 | L/O/TL/TA/TO rejects biometric/media/free-text extensions | No media processor or SDK; deployed all-channel storage/network audit pending |
| EX-04 | O/TO actual Hono withdrawal races, abort and old-binding rejection | Real media gateway/presigned object URLs absent and intentionally unavailable |
| EX-05 | L/R/TL/TR separates consent/device revocation from existing rights | Real independent legal processing bases and provider access revocation pending |
| EX-06 | R/TR enumerates actual V2 pairs, duplicate/AI/domain denial | Real independent organizations not established |
| EX-07 | R/TR current registry/control/conflict changes invalidate approvals | Independent registry governance and authoritative DB administration review pending |
| EX-08 | B/R/TA software boundary | No institution-side bank/KMS/DB/module bypass acceptance; not claimed solved |
| EX-09 | R/TR immutable protections and future-only governance | Real appointments/removal/operational governance evidence absent |
| EX-10 | R/S/TR destination/version/content and exact-field changes | Real recipient ownership verification/provider enforcement absent |
| EX-11 | R/TR cumulative beneficiary/funding-cycle checks; DB rewrite | Pure model serializes transitions; native concurrent authoritative-limits test pending |
| EX-12 | R/TR unknown request retains reserves/no changed-ID blind repayment | No actual provider call or durable production dispatch/reconciliation acceptance |
| EX-13 | R/TR backup/checkpoint predicate; O/TO restored drafts fail closed | Real database restore plus independent deletion/revocation/execution checkpoints pending |
| EX-14 | R/TR accepted/processing versus final synthetic receipts | Real signed webhook authentication, authoritative provider query and finality mapping unavailable |
| EX-15 | UI S34 distinguishes local pause from external freeze | Actual institution freeze lifecycle/receipts unavailable |
| EX-16 | R/TR unfunded vested debt, partial funding, settlement/refund properties | Full DB/reconciler accounting acceptance pending |
| EX-17 | R/TR return to original protected destination | Actual refund institution/channel not configured |
| EX-18 | L/TL/TA guardian GET/revision/POST-probe non-disclosure | Real notification/helpdesk/backups and controller-issued independent accounts unavailable |
| EX-19 | L/TL repeated-case dedup preserves case/time and scope | Operational SLA/escalation staffing and broader cross-account abuse testing pending |
| EX-20 | R/TR no guardian veto in qualified transition; UI states | Real substitute staff, court/agency/refuge and provider-exit paths absent |
| EX-21 | L/R/TL/TR canonical activity/outcome keys exclude policy/request | Synthetic session/project scope; actual DB global economic uniqueness under rewrite |
| EX-22 | L/R/TL/TR aliases retain canonical attribution/cumulative cap | No global real-person linkage; no invasive identity service installed |
| EX-23 | R/TR prefunding, capped attribution and retained rounding remainder | Real sponsor budgets and final native DB concurrent source accounting pending |
| EX-24 | L/R/TL/TR same-subject alias/recovery preserves rights/destination | Verified real representative/identity correction absent |
| EX-25 | R/TR special legal-subject correction conserves amounts | Real legal evidence and native concurrent split/merge acceptance pending |
| EX-26 | O/TO local draft/key purge; L/TL pending request | Full deletion pipeline incomplete; never mark request completed from these tests |
| EX-27 | L/TL no coordinates/aliases in family output, fixed synthetic public material | Real re-identification corpus, public query inference and small-cell suppression acceptance pending |
| EX-28 | L/TL one synthetic AgePolicy; R/TR reviewed capacity transition | Country-specific rules, age assurance and capacity evidence absent; no fixed-18 unlock |
| EX-29 | L/R/TL/TR schema and rights-kind rejection | Full relational enforcement and cross-route financial type safety acceptance pending |
| EX-30 | R/TR contractual versus retirement type boundary | Real non-carbon grant and carbon registry adapters unavailable |
| EX-31 | L/A/TL E0 remains unknown, unverified time, no sample-to-field upgrade | E2/E3/E4 forestry data and subgroup error analysis not implemented/accepted |
| EX-32 | UI unavailable service states; R quorum enforcement | Staff capacity, 10× workload, offline-family operations and contracted exit exercise absent |
| EX-33 | S/TS primitive; R/TR kernel; A/TL adapter; API/TA actual Hono rejection without business effects | Final native DB route effects and actual provider/media/official-protocol acceptance remain distinct pending work |

## Human experience contracts UXT01–UXT22

All UXT participant success percentages and child/family study outcomes remain
**unmeasured**. Automated assertions and a local Chromium walkthrough do not
stand in for those studies. Real-child research requires its own approvals.

| ID | Screens/code/automated mapping | Human or operational acceptance still required |
| --- | --- | --- |
| UXT01 | S06–S08, UI/A/TB role-comprehension retry | Children understand static AI explanation and limits |
| UXT02 | S09/S20/S29, UI/L | Age-appropriate distinction between observation, review and credit |
| UXT03 | S10–S19, UI/O/TB completed local flow | Target age/access-needs task-completion study |
| UXT04 | S01/S12/S13, UI/TB no permission prompts | Refusal/alternative paths with actual users |
| UXT05 | S04/S15/S16/S26, O/TO/TA | Field-device withdrawal comprehension; actual media remains unavailable |
| UXT06 | S15/S16/S27, O/TO/TB | Broader device/power-loss/three-engine reliability |
| UXT07 | S06/S20/S21, L/TL/UI | User understanding of stale/unknown/adverse states |
| UXT08 | S02/S27, UI/B | Real nonbiometric authentication/recovery acceptance, currently unavailable |
| UXT09 | S10/S11/S30, UI/L/A | Expert/child safety review of real tasks; field actions unavailable |
| UXT10 | S12/S13, O/TO closed inputs | Real faces/uniforms/EXIF processing acceptance, currently unavailable |
| UXT11 | S06–S09/S31, A/TL/UI | Live-model adversarial testing and child interpretation |
| UXT12 | S21/S22, UI | Child psychology/education review and opt-out understanding |
| UXT13 | S23/S24/S30, L/TL/TA/UI | Staffed local protection workflow and safe disclosure testing |
| UXT14 | All screens, UI/TB keyboard/focus | Independent full WCAG 2.2 AA and assistive-user testing |
| UXT15 | S12–S16/S28, O/TO/UI | Controlled 400 kbps/400 ms and compressed first-screen budget evidence |
| UXT16 | S19/S21/S22/S26, UI/L | Long-absence/pressure-free comprehension and expert content acceptance |
| UXT17 | S25/S27, L/TL/TA | Actual institution/guardian/maintenance identities and operational access tests |
| UXT18 | S17/S20/S24, L/TL | All published/external copies updated with understandable limitations |
| UXT19 | S09/S20/S29/S31/S32, UI/L/R | Participants distinguish all four ledgers and three business domains |
| UXT20 | S31–S35, R/TR/TA | Real custodian and independently verified actors prevent appropriation |
| UXT21 | S31/S32/S33, UI/R/TR | Users understand unfunded debt versus spendable/finally settled funds |
| UXT22 | S26/S34/S35, L/R/TL/TR | Real lawful continuity, transfer and independently reachable appeal |

## Screen contract S01–S35

All screens are implemented in UI/catalogue and traversed by the local Chromium
diagnostic; the row below distinguishes working synthetic interaction from
information about an unavailable capability. Shared offline/error/empty states
must still undergo complete three-engine, assistive-technology and final-artifact
testing. Rendering a screen is not completion of its underlying real service.

| Screen | Synthetic implementation | Actual service boundary |
| --- | --- | --- |
| S01 | Welcome, adult/learning entry, exit | No registration or permission prompt |
| S02 | Explicit demo-account explanation | Real Passkey unavailable |
| S03 | Fixed fictional profile/age-band/readability choices | No personal name, birth date or contacts |
| S04 | Separate learning/upload choices | Demo assent and consent only |
| S05 | Authored sample tree/source | No real ownership or plot permission claim |
| S06 | Current knowledge unknown and historical context | No current survival assertion |
| S07 | Static explainer identity and retryable comprehension question | No live model or sentient-tree claim |
| S08 | Approved short question/answer choices | No free text, tools or external queries |
| S09 | Sample source and limits | No real field proof |
| S10 | Indoor leaf-comparison task | No outdoor dispatch |
| S11 | Safety explanation and indoor alternative | No child field-risk judgment |
| S12 | Preset observations including uncertainty | No camera, microphone or file upload |
| S13 | Exact synthetic draft preview | No automatic real-media sanitizer claim |
| S14 | Explicit local encrypted save | No premature server receipt |
| S15 | IndexedDB draft list and cleanup | Per-browser/profile local storage only |
| S16 | Real Hono connection/preflight/receipt when configured | Unavailable backend remains unavailable; no simulated success fallback |
| S17 | Explicit demo reviewer action and learning-only result | No actual ecology reviewer or survival verification |
| S18 | Task receipt from synthetic exercise | No claim of performed field care |
| S19 | Observation notebook and educational feedback | No ranking, transferable points or money |
| S20 | Contribution scope and limitations | Not a carbon credit or replacement for existing rights |
| S21 | Unknown/last-known explanation | No automatic death inference |
| S22 | Optional synthetic death/memory scenario | No verified real-tree death or child fault |
| S23 | Preset synthetic dispute exercise | Real safeguarding intake and free text unavailable |
| S24 | Actual synthetic case receipt where API available | No invented human response/ETA/resolution |
| S25 | Adult demo view and permissions | Token role is not verified guardianship |
| S26 | Local immediate stop and server withdrawal confirmation distinction | Server/downstream deletion not promised complete |
| S27 | Local draft/key purge, account-recovery limits | Real recovery unavailable; no biometrics |
| S28 | Text-size/low-motion/text alternatives | Voice/localization and full accessibility acceptance pending |
| S29 | Adult explanation of credit boundaries | Registry adapter and trading unavailable |
| S30 | Stop and trusted-adult guidance | No real-time rescue or staffed report service |
| S31 | Rights-source explanation and unavailable state | No fabricated legal entitlement |
| S32 | Separate obligation/funding/payment explanations | No spendable balance or actual institution receipts |
| S33 | Protected-spending prerequisites and closed action | No real payment submission |
| S34 | Local pause versus confirmed institution freeze distinction | No external freeze or recovery guarantee |
| S35 | Guardian/capacity continuity explanation | No automatic age-18 unlock or actual transfer |

## Module completion and release checklist

No module should be marked complete solely from these links. The specification's
completion definition also requires versioned contracts, authoritative migration
and rollback, access/error tests, accessible pages, minimum telemetry, runbooks,
and applicable independent acceptance evidence. Remaining blockers include:

- Final normalized authority migration, actual PostgreSQL adapter/API concurrency,
  constraints, recovery/reconciliation and outbox receipts after the active rewrite.
- Build/Prisma/browser download blockers documented in BUILD; final same-SHA
  existing CI, sealed artifact, workerd, route/binding and rollback checks.
- Full media processing and full deletion pipeline; these capabilities remain
  unavailable or explicitly pending rather than returning success.
- Real Passkey, guardianship/age assurance, protocol/provider contracts, legal
  institutions, funded protection arrangements and operational staff.
- Human WCAG, childhood comprehension/fairness, local safeguarding/ethics and
  jurisdiction-specific reviews.
- Qualified independent approvals required by the existing release workflow.

Private correspondence and source-section 18.1 are intentionally absent.
