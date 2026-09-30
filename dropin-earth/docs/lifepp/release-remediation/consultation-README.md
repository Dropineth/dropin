# Consultation receipt remediation

Status: **IMPLEMENTED_DEFAULT_DISABLED / LOCAL_SYNTHETIC_TESTED / REAL_RECEIPT_BLOCKED_CONFIG**.

This work adds an optional receiving adapter to the existing Life++ enquiry form. It does not create a database, select an unconfirmed recipient, send an email, deploy a Worker, or change the existing ecological `/feedback` service. No real person’s enquiry has been received or delivered by this work.

## Discovery and choice

Read-only inspection in the authorized isolated worktree found:

- The web deployment configuration exposes static assets and its self-reference service; it contains no consultation D1 binding.
- The worktree has no `.env`, `.env.local`, web `.env.local`, or `.dev.vars` receiver configuration. Relevant process-variable presence check returned no configured database, mail, inquiry or feedback keys. No secret values were printed. Remote secret stores were not inspected by this subtask.
- The existing API feedback repository can select `InMemoryFeedbackRepository` when no database is configured. Its audit log copies the feedback record, including its body. This does not establish verified durable consultation receipt or an accepted retention policy, so that path is preserved unchanged.
- Production `/api/*` belongs to the separate API Worker. The new route handlers are consequently `/life/inquiries` and `/life/inquiries/maintenance`, inside the web Worker namespace. They are not navigation pages or sitemap entries.

The adapter uses a dedicated optional D1 binding. It performs no HTTP forwarding to an outside recipient and cannot use a browser `NEXT_PUBLIC_*` flag to activate collection. The application reads its binding and configuration only in a request-scoped server module.

## Authority and request behavior

`GET /life/inquiries` returns `{ "mode": "draft" }` unless **all** of these are true: valid server configuration; explicit enable flag; database schema; matching policy and acceptance references recorded in the database; and a successful cleanup heartbeat no older than one hour. Its response is `no-store`. The browser begins in draft mode and only renders the separate send consent/action after this server response enables receiving. Configured mode still does not submit automatically.

`POST /life/inquiries` independently repeats the server checks and requires:

- Exactly the configured Origin, `Sec-Fetch-Site: same-origin`, and `X-LifePP-Inquiry: 1`; JSON only, no content encoding, at most 8 KiB, and a five-second body-read deadline. No permissive CORS is emitted.
- The exact allowlisted field schema and existing length/contact checks; consent to composing a draft is **not** sending consent. A separate `sendConsent: true` and current `policyVersion` are required. Honeypot content is rejected.
- A Cloudflare-provided client address for rate admission. The address is never stored in plaintext: a server-keyed per-hour HMAC identifies its bucket.
- Atomic D1 admission: at most three new requests per client bucket per hour and 100 admitted requests globally per hour. Duplicate retries and already-denied client attempts do not consume the global allowance. These are conservative software limits, not operating capacity claims.
- A UUID idempotency key bound to a canonical, keyed content-and-policy fingerprint. Same-key/same-content/same-policy retries resolve to one receipt; changed content or sending-consent policy with an existing key returns conflict.

The database batch and subsequent read-back must succeed before the response says `stored`. This is a storage receipt, **not** proof of email delivery, staff reading, a contract, payment or training permission. Storage failures produce a generic unavailable result and never a success receipt. A connection loss is reported as unknown receipt state; retry keeps the same identifier until the user changes the draft. After an unavailable/policy-conflict response the send action is removed, but a GET-only recheck can restore it after server readiness returns, retaining the same identifier and requiring fresh explicit sending consent. Reloading or clearing the page loses that identifier and is not a safe retry mechanism.

`DELETE /life/inquiries` accepts only receipt ID and withdrawal credential in its JSON body with the same origin requirements. The credential is checked against a stored keyed hash; it is not sent in a URL or logged. A single transaction deletes the enquiry record and retains only a keyed idempotency marker and original expiry, preventing old in-flight requests from recreating withdrawn personal data. This marker contains no enquiry body or contact details and is removed by expiry cleanup. The response confirms absence of the enquiry record from the primary store only, not backup erasure. The user must preserve the credential; the application does not place it in localStorage or sessionStorage. A deployment must provide an authorized support/withdrawal process for users who no longer have the credential before public activation.

No consultation request body, contact detail, raw client address, secret, credential or entire record is written to application logs. Persistent metadata is limited to receipt ID, keyed dedupe and withdrawal hashes, policy version and timestamps, alongside the minimal enquiry body. Rate rows expire at the end of their hour. There is no user-facing listing endpoint; authorized operators must use approved database administration, filter expired records and avoid unrestricted exports.

## Required configuration — not currently supplied

| Item | Requirement |
| --- | --- |
| `LIFEPP_INQUIRY_DB` | An independently authorized dedicated D1 binding. No database ID or resource is invented here. |
| `LIFEPP_INQUIRY_ENABLED` | Must remain absent/false until every item below is independently accepted. |
| `LIFEPP_INQUIRY_SITE_ORIGIN` | Exact canonical HTTPS origin, without path, query, credentials or trailing slash. |
| `LIFEPP_INQUIRY_CONTROLLER` | Confirmed receiving/data-control entity to show before consent. No default recipient. |
| `LIFEPP_INQUIRY_RETENTION_DAYS` | Operator-approved integer from 1 to 30; there is no default retention promise. |
| `LIFEPP_INQUIRY_POLICY_VERSION` | Version of the accepted privacy/retention/withdrawal policy. |
| `LIFEPP_INQUIRY_ACCEPTANCE_REF` | Reference to completed deployment acceptance evidence; never a fabricated receipt. |
| `LIFEPP_INQUIRY_BACKUP_NOTICE_ZH`, `LIFEPP_INQUIRY_BACKUP_NOTICE_EN` | Confirmed bilingual backup/restore retention and withdrawal limitations. Primary deletion does not establish backup erasure. |
| `LIFEPP_INQUIRY_HMAC_KEY` | Separate server secret, at least 32 characters. Rotation needs a receipt/withdrawal migration plan. |
| `LIFEPP_INQUIRY_MAINTENANCE_TOKEN` | Different server secret, at least 32 characters, held only by the authorized cleanup scheduler. |
| Cleanup schedule and evidence | Authenticated maintenance invocation at least hourly, alerting on failure, and verified deletion/heartbeat. No scheduler is created by this task. |
| Receiver/access/withdrawal operations | Approved operator access, a real user support route, backup policy and authorized recipient identity. |

Apply `apps/web/migrations/life-inquiry/0001_inquiry.sql` only to the independently approved database. It creates schema version `1` but **does not** create acceptance records. After receiving, persistence/restart, withdrawal, expiration, backup policy, scheduler and access tests are accepted, an authorized operator must record `acceptance_ref` and `policy_version` in `lifepp_inquiry_control`, matching the configured values. This step is not performed here. Generate actual Cloudflare binding types from that approved deployment configuration.

The maintenance endpoint requires `Authorization: Bearer <maintenance secret>` and performs transactional deletion of expired enquiry, withdrawal-marker and rate rows followed by the heartbeat update. It does not inspect or return enquiry bodies. Missing or stale cleanup heartbeat stops **new** collection; primary deletion still depends on the maintenance job, and operator alerting/remediation remains necessary during outages. Keep the database binding and valid private configuration available for maintenance/withdrawal when disabling new receiving; do not merely remove those capabilities while records remain. Do not represent this as a guarantee of deletion from provider backups.

## Evidence and limits

`consultation-test-results.txt` records the focused automated tests, `consultation-browser-results.txt` the mocked UI fixture result, `consultation-lint.txt` the scoped lint output (empty on success), and `consultation-status.json` the exact commands, source hashes and result boundaries. Final local review after the Deck/OpenNext dependency installation passed **5/5 focused tests**, the **six-check UI fixture**, and **scoped lint**. The real local D1 engine is used with **LOCAL_SYNTHETIC** identities, `example.invalid` contact data and a temporary storage directory. Tests actually write data, dispose/reopen the local runtime and read back the row, then exercise token-authorized withdrawal and time-based deletion. This validates local adapter behavior; it is not real institutional receipt, an external recipient test, production D1 acceptance or a verified cleanup scheduler.

Covered: default/partial configuration closure, strict schema, independent send consent, origin/CSRF checks, malformed/oversize body, outdated policy, missing client identity, persistence/read-back, same-content retries, conflicting duplicates and consent-policy changes, client and global rate limits under concurrency, concurrent identical requests, persistence after restart, invalid withdrawal token, primary deletion, prevention of post-withdrawal replay, stale cleanup lockout, expiry cleanup and storage failure without a success receipt. The five-second stalled-body branch is implemented but not time-based-tested in this focused suite. `tests/browser/lifepp-consultation.spec.ts` separately exercises the optional form branch with mocked responses only; that **LOCAL_SYNTHETIC_MOCK_UI** evidence is not backend persistence or actual recipient acceptance. Real enabling/configured behavior requires deployment acceptance.

No new dependency or package-lock change was made by the consultation implementation. The focused suite and scoped lint were run after the release agent's clean dependency install with Node 22.22.3. `consultation-typecheck.txt` preserves an intermediate full-web failure in the unrelated MapLibre default import; the release agent subsequently corrected that import. Root/release verification is the source of truth for final whole-app typecheck, lint, Next build, OpenNext/workerd route checks and default form browser regression against the final dependency tree and commit.

References consulted: [D1 database API and transactional batch behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/). Neither documentation nor local schema checks establish current receiving authorization.
