# Isolated child backend transport (default closed)

This change is a private service-binding seam, not a deployed child service,
production enrollment, guardian verification, or a PostgreSQL migration.
There is no child service name, URL, credential, database, or paid resource in
this configuration. Nothing is provisioned or deployed by this change.

## Routing contract

- `/api/canopyproof/child-stewardship` and its subpaths never fall back to
  `DROPIN_API_ORIGIN`, even when the latter is memory/mock.
- Only canonical v1 paths, `DROPIN_CHILD_BACKEND_MODE=synthetic-demo`, and an
  actual `CHILD_BACKEND` HTTP service binding can forward. Missing, disabled,
  unknown and real/pilot modes return 503. Encoded child aliases are rejected.
- HTTP service bindings target a Worker selected by the binding, not by the
  request hostname. The transport preserves the incoming URL origin and query,
  strips `/api`, streams the body and forwards only the backend's required
  bearer, precondition, idempotency, origin and request-metadata headers.
- Existing exact Origin and PR45 preflight policy remain. Non-child routes and
  admin restrictions retain their existing global origin. No cookies, caller
  identity claims or trace baggage are forwarded on child routes. Child data
  does not enter the generic edge span exporter.
- Responses are private/no-store, no-referrer and non-frameable; backend CORS,
  cookies, redirect hints and diagnostic headers cannot widen that policy.
  Backend denial statuses are preserved. Binding failures are sanitized 503;
  redirects are not followed. The proxy never retries or switches stores.
  A failed transport is NOT proof that a command did not commit. Reconcile via
  the backend's existing idempotency contract before any deliberate retry.
- OPTIONS may return the existing 204 preflight even while the backend is
  closed. It grants neither identity nor capability. Requests still fail closed.
- The edge adds no positive-authority readiness probe before logout/cancel.
  Existing backend checks, including its current readiness middleware, remain
  authoritative and unchanged.

## Required before an operator binds a service

1. Verify the exact approved target Worker and source revision. Cloudflare HTTP
   service bindings cannot directly address the repository's existing Node
   server. A separately reviewed Worker adapter or private gateway must connect
   to that isolated service; this PR does not create one. Do not bind the
   memory/mock origin, generic API, or synthetic Durable Object example.
2. Keep `DROPIN_CHILD_BACKEND_MODE=disabled` until that target and its budget are
   approved. Configure `CHILD_BACKEND` using the verified service identity in
   each intended Wrangler environment. Bindings are not inherited across
   environments. No placeholder service identity is provided for deployment.
3. Preserve `services/api/src/child-backend` and the PostgreSQL domain contract:
   independently restricted runtime LOGIN, no owner/BYPASSRLS/admin/membership,
   verified TLS, migrations and role checks, FORCE RLS, transaction-local scope,
   row locks, immutable audit/checkpoint history, deferred constraints, scoped
   verifier roles and current per-session signed authority. No D1, memory or
   single-owner DO substitution. Never put migration/verifier credentials in
   the proxy. The service binding itself is NOT authentication or independent
   guardian/current authority, and Cloudflare Access context is not propagated.
4. Establish independently controlled real guardian/enrollment and current
   authority services before claiming real capabilities. Existing backend
   config and signed authority protocol remain synthetic-only; setting an edge
   flag cannot change that. Preserve `realCapabilities:false` and closed real
   enrollment until the separately authorized service work is verified.
5. Run exact-revision CI, native PostgreSQL security/concurrency suites and
   private workerd staging tests. Verify both approved origins, unauthorized
   callers, missing binding, backend dependency outage, stale/revoked authority,
   cross-session access, privacy export release, logout/cancel and uncertain
   command reconciliation. Confirm observed target/service revision and rollback
   identity, then use the normal protected release workflow. This seam's unit
   fixtures are not a hosted service-binding or native-PostgreSQL acceptance run.

## Resource and cost boundaries

Read-only account inspection on 2026-11-12 found no Hyperdrive configuration and
no service/database binding on the existing API proxy or its memory/mock origin.
An existing D1 named `canopyproof-production` is not evidence of a PostgreSQL
backend and is not reused. Actual billing plan, remaining budget and a suitable
approved PostgreSQL resource have not been verified.

Cloudflare Standard service-binding subrequests do not add request charges;
combined Worker CPU usage still counts. Backend hosting/database, networking,
storage and other product charges need separate verification. No new resources,
purchases, bindings or production settings are authorized by this document.

References:
- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- https://developers.cloudflare.com/workers/platform/pricing/#service-bindings
