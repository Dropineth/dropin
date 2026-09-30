# R3 consultation review — draft only

Reviewed on 2026-09-30 against baseline `7613ee6b2b7e32560b49ecb5947b18aa5dc25b71` and the shared worktree's subsequent R3 edits. The consultation source hashes and check timestamp are recorded in the ignored `reports/lifepp-validation/r3-preflight/consultation-review.json`. This is a source/configuration review plus bounded local tests, not production receipt acceptance or a final-candidate CI result.

**Outcome: DRAFT_ONLY / LOCAL_SYNTHETIC_TESTED / REAL_INSTITUTIONAL_RECEIPT_NOT_ESTABLISHED.** No confirmed receiving entity, approved production persistence binding, accepted operational retention/backup policy, cleanup scheduler or authorized real-recipient test was established in the inspected configuration. Sending stays unavailable. No email, external enquiry, remote database write, resource creation, install, build, deployment or account change was performed.

## Configuration and existing capability

The review inspected `apps/web/src/lib/life/inquiry-{runtime,service}.ts`, both `/life/inquiries` route handlers, the dedicated migration, the form/draft helpers, existing focused tests, all three web Wrangler configurations, the current Life++ CI workflow and the existing feedback repository/service. Applicable `docs/AGENTS.md` was read.

| Inspected surface | Observation | Interpretation |
| --- | --- | --- |
| `apps/web/wrangler.jsonc`, `wrangler.local.jsonc`, `wrangler.staging.jsonc` | No `LIFEPP_INQUIRY_DB` binding, no consultation variables, no scheduled triggers | These checked-in configurations do not enable collection or schedule cleanup. |
| Worktree `.env`, `.env.local`, `.dev.vars`; web `.env`, `.env.local`, `.dev.vars`, `.dev.vars.local`, `.dev.vars.staging` | All eight files absent | No receiver configuration discovered in these authorized local paths. |
| Current process | None of the 11 inquiry configuration/binding keys present | Presence-only inspection; no secret values printed. The shell process is not the deployed Worker environment. |
| `.github/workflows/lifepp-web.yml` | Existing focused unit and mocked consultation UI fixture commands; no inquiry receiving configuration | CI fixture execution does not identify or authorize a real recipient. No fresh remote workflow result is claimed here. |
| Adapter | Dedicated optional D1 storage; no mail sender or HTTP forwarding target | A successful response means stored/read back, not email delivery or staff reading. |
| Existing `/feedback` implementation | Selectable memory/Prisma repository; feedback body also copied into its audit record | Existence of this service does not establish accepted consultation persistence/retention. It remains unchanged and is not repurposed. |

The 11 checked names were `LIFEPP_INQUIRY_DB`, `LIFEPP_INQUIRY_ENABLED`, `LIFEPP_INQUIRY_SITE_ORIGIN`, `LIFEPP_INQUIRY_CONTROLLER`, `LIFEPP_INQUIRY_RETENTION_DAYS`, `LIFEPP_INQUIRY_POLICY_VERSION`, `LIFEPP_INQUIRY_ACCEPTANCE_REF`, `LIFEPP_INQUIRY_BACKUP_NOTICE_ZH`, `LIFEPP_INQUIRY_BACKUP_NOTICE_EN`, `LIFEPP_INQUIRY_HMAC_KEY`, and `LIFEPP_INQUIRY_MAINTENANCE_TOKEN`. Only names/presence were inspected in runtime configuration. No unrelated credential files, secret values, personal recipient addresses or remote secret stores were read. Absence from these local surfaces is **not** a claim that remote configuration cannot exist; deployed receiving state remains unverified.

## Server and retention boundaries

- Runtime discovery reads the request-scoped Cloudflare binding. No memory-store or `NEXT_PUBLIC_*` fallback can activate collection. Missing/invalid configuration, missing schema, mismatched acceptance/policy references or a cleanup heartbeat older than one hour returns draft mode. Status responses are `no-store`.
- Routes are `GET/POST/DELETE /life/inquiries` and `POST /life/inquiries/maintenance`, outside the independent `/api/*` namespace. This review does not modify or independently verify active production routing. The existing full-page browser suite contains draft-only GET and rejected write/maintenance checks; it was not rerun as part of this bounded review.
- POST repeats server checks, requires exact configured HTTPS Origin, `Sec-Fetch-Site: same-origin` and the custom header, validates an exact JSON field schema, rejects honeypot content, limits bodies to 8 KiB and applies a five-second read deadline. Draft consent alone is insufficient: separate sending consent and the current policy version are required.
- D1 transactional admission limits new requests to three per client-hour and 100 globally per hour. Stored client buckets are keyed hashes rather than raw addresses. Same-key retries do not consume additional global capacity; payload/policy conflicts are rejected. Local concurrency tests cover distinct requests, identical requests and the global limit.
- A storage receipt requires the write and subsequent read-back. No request body, contact detail, raw client address or withdrawal credential is explicitly logged by the adapter. This is an application-source observation, not a verification of provider/platform logging settings.
- Primary retention must be an explicitly configured 1–30 days. Authenticated maintenance removes expired enquiries, withdrawal markers and rate rows before updating the heartbeat. A stale heartbeat stops new receiving, but does not itself delete existing data; actual cleanup, monitoring and incident handling still require an accepted operator schedule.
- Withdrawal deletes the primary enquiry and retains only a keyed deduplication marker until its original expiry. The marker prevents an old retry from recreating withdrawn content. Primary deletion does not establish backup erasure. A valid configuration/binding must remain available for cleanup and withdrawal even when new receiving is disabled.
- The acceptance reference is a checked configuration/database agreement, not independently authenticated institutional approval. The operator must supply genuine acceptance evidence and a usable withdrawal/support process before activation.

## Accuracy issue found and fixed in this review

The prior form used one shared `receiptUnknown` boolean. After request A lost its response, editing the form created request B with another idempotency key; B's successful storage receipt could clear A's still-unknown state.

The authorized repair changes only `LeadForm.tsx` and the existing consultation UI fixture. A set of unresolved request identifiers now lives in page memory, with no additional enquiry body or contact data. A verified `stored` response removes only that response's request key. Draft generation/copy, editing, availability rechecks, clearing a later receipt and a later request's success do not resolve unrelated attempts. Success/removal wording refers to the current enquiry or receipt. The CSS and server adapter are unchanged.

The added fixture exercises A's lost response, editing to a distinct B key, availability recheck, B's successful storage receipt alongside A's unknown warning, and clearing B's displayed receipt while A remains unknown. Existing same-key recovery still proves that a confirmed receipt resolves that particular request. Identifiers are not written to localStorage/sessionStorage; closing or reloading the document loses this local history and is not a server-status check or safe retry mechanism.

## Fresh local evidence

Runtime: Node `22.22.3`, npm `10.9.4`, existing installed Chrome `154.0.8037.58`. No dependency or browser download was performed.

| Check | Actual result | Evidence |
| --- | --- | --- |
| `node --test --import tsx tests/unit/lifepp-inquiry.test.ts tests/unit/lifepp-consultation.test.ts` | 5 passed, 0 failed | `reports/lifepp-validation/r3-preflight/consultation-tests.txt` |
| `node --import tsx tests/browser/lifepp-consultation.spec.ts` after the repair | PASS; 14 named checks; six synthetic POST attempts; no uncaught browser errors | `reports/lifepp-validation/r3-preflight/consultation-ui-r3.json` and `.txt` |
| Scoped ESLint for the modified form and fixture | PASS | `reports/lifepp-validation/r3-preflight/consultation-lint.txt` |
| Web TypeScript, `--noEmit --incremental false` | PASS | `reports/lifepp-validation/r3-preflight/consultation-typecheck.txt` |

The focused D1 test actually writes synthetic data to temporary local storage, disposes/reopens the runtime, reads the row back, checks atomic admission and concurrent deduplication, withdraws it, prevents post-withdrawal replay, advances test time and deletes expired records. This is **LOCAL_SYNTHETIC local persistence**, not a real institution's enquiry receipt. Its temporary store is removed after the run.

The UI test is **LOCAL_SYNTHETIC_MOCK_UI**. All receiving responses and failures are mocked on loopback. It does not use the actual backend to prove receipt, and no production email or institution was contacted. The earlier `consultation-ui.json` is the pre-repair baseline fixture result; the suffixed `consultation-ui-r3.json` is the final repaired-form result. Initial new-scenario runs exposed a strict locator mismatch after a populated textarea rerender; the final scenario uses the accessible textbox role/name and passed without weakening any receipt-state assertion.

Unverified: deployed receiving/route state, real recipient identity and test authorization, production D1 persistence and access, real scheduler/alerts, provider backup retention and erasure, external receipt, real mobile devices, and the five-second stalled-body branch under a timed test. No whole-app build or fresh remote CI was executed by this subtask; the root task must validate the final candidate after integration.

## Minimum inputs before real receiving can be considered

Keep `LIFEPP_INQUIRY_ENABLED` absent/false until an authorized operator supplies and verifies the existing adapter's complete configuration: dedicated D1 binding; exact HTTPS origin; confirmed receiving/data-control entity; accepted retention days and policy version; genuine acceptance reference; bilingual backup/withdrawal notices; distinct HMAC and maintenance secrets; verified cleanup schedule with monitoring; authorized operator access and a real support/withdrawal route. Then run an explicitly authorized, non-personal test against that specific receiver/store, including persistence, restart/read-back, withdrawal and expiration, and preserve the actual acceptance evidence. No new mailbox, resource or paid service is required or created by this review.

Configuration and operational detail remains in [the consultation adapter notes](release-remediation/consultation-README.md). Those notes and this review describe a conditional capability; neither enables it or supplies missing institutional authority.
