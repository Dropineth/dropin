# Child private gateway: code only, default closed

This gateway connects PR47's `CHILD_BACKEND` HTTP Worker service binding to a
**single-target HTTP VPC Service**, then to the unchanged isolated Node backend.
It does not move PostgreSQL into Workers, alter SQL or introduce Hyperdrive.
No real target, service ID, tunnel, key, database or resource is configured here.
Nothing has been deployed or connected. All capabilities remain synthetic-only.

## Intended topology, not deployed infrastructure

`API proxy -> CHILD_BACKEND -> gateway Worker -> CHILD_PRIVATE_API VPC Service
-> approved private Node child backend -> original PostgreSQL`

The sample configuration has no public route, workers.dev/preview URL, private
origin or VPC binding. `DROPIN_CHILD_GATEWAY_MODE=disabled` is the default; only
explicit `synthetic-demo` can forward, and only after both exact HTTPS origins
and a `CHILD_PRIVATE_API` binding are present. Unsupported or absent settings
fail closed. The sample's Worker name is a replacement marker, not a resource.
Do not run a real deploy or enable remote local-development bindings from it.

Configure each intended environment separately only after approval:

- `CHILD_PRIVATE_ORIGIN`: one verified exact HTTPS origin matching the private
  service's TLS certificate/Host/SNI, with no credentials, path, query or fragment.
  It is never inferred from incoming URLs, headers, query parameters or bodies.
- `CHILD_GATEWAY_ALLOWED_ORIGIN`: one approved exact HTTPS browser origin,
  matching the Node backend's existing `CHILD_WEB_ORIGIN`. The proxy's global
  Origin allowlist is unchanged. A second browser origin requires separately
  reviewed backend policy; never rewrite an Origin to make it appear approved.
- `CHILD_PRIVATE_API`: `vpc_services` binding using an approved `service_id`.
  Do not configure a `vpc_networks` binding under this name. VPC Services pin
  one destination host/port; VPC Networks grant broader network reach and use
  request URLs for routing. Their similar fetch interfaces are not equivalent.
- Keep origin TLS `verify_full`. A VPC Service ignores the fetch URL's port for
  routing, but uses its host for Host/SNI; configuration and certificate must
  agree. Verify the tunnel-to-origin path, not only public edge TLS. If the
  existing Node HTTP listener needs a TLS terminator, approve that component
  separately. Do not disable certificate verification to make it connect.

## Authentication and privacy

An allowed Origin is **not** proof of identity: non-browser clients can forge it.
The gateway never creates identity, canonicalizes Origin, changes bearer tokens,
adds trusted actor claims, or treats service-binding reachability as guardian
verification. It preserves absent Origin as absent and rejects disallowed Origin
or explicit cross-site metadata. Backend token/proof/role/current-authority and
per-operation PostgreSQL checks remain mandatory, including proof-based guardian
session exchange. Accepted Origin plus missing/forged credentials must still fail
at the backend; transport success is not authority success.

Only canonical child v1 paths and GET/HEAD/POST/OPTIONS can reach the binding.
PR47's request-header allowlist excludes cookies, caller identity/forwarding
headers, trace baggage and arbitrary headers. Bearer, revision, idempotency and
upload authorization remain opaque. Bodies stream without gateway inspection.
No redirects, fallback origin or automatic retries exist. A transport failure
can follow a committed command, so never claim that the command did not commit.
Responses retain denial statuses and private/no-store, no-referrer protections;
backend cookies/CORS/redirect hints/diagnostics cannot escape through the gateway.
The gateway itself grants no CORS policy. Existing outer-proxy policy still applies.

The example intentionally disables automatic request logs/traces pending a
privacy-safe observability review. That is an **activation gap**, not production
observability readiness. Before release, approve fixed-vocabulary operational
signals and data-minimized metrics without URL/query/body/authorization capture.

## Preserve PostgreSQL semantics

Reuse `services/api/src/child-backend/server.ts`, `database.ts` and the existing
SQL/domain unmodified: direct restricted LOGIN, `current_user=session_user`,
no owner/BYPASSRLS/membership/verifier elevation, verified database TLS, explicit
transactions, transaction-local GUCs, FORCE RLS, row locks, deferred constraints,
current authority and cleanup. Migration and verifier credentials remain outside
both Workers. The VPC gateway carries HTTP only, not SQL or database credentials.

A later Worker/Hyperdrive port requires a separate adapter/conformance project:
Hyperdrive does not support `DISCARD`; the existing pool uses `DISCARD ALL` after
each checkout. Transaction pooling and query caching differ from the Node pool.
Never silently drop cleanup or replace PostgreSQL with D1/DO/memory. The current
authority contract remains `SIMULATION_ONLY`; network wiring cannot establish
real guardian independence, real enrollment, payments, PoCC or ChainRank.

## Local validation toolchain

The new Worker uses compatibility date `2026-11-12`. The repository's locked
Wrangler 4.148.0 bundles a workerd binary supporting dates only through
`2026-10-13`; its default local runtime cannot start this example. Do not lower
the date silently or describe a dry-run bundle as runtime acceptance. The local
gateway smoke was run with separately installed official `workerd@1.20261112.1`
using Miniflare's supported `MINIFLARE_WORKERD_PATH` override. No repository
dependency or lockfile was changed. A reproducible approved runtime/toolchain
update remains part of deployment preparation. Wrangler's `--dry-run` validates
the bundle/configuration but does not contact a real VPC service.

## Verification before activation

1. Identify approved Node host/service revision, private endpoint, tunnel and
   single-target VPC Service; verify ownership and incremental budget. A healthy
   unrelated tunnel is not authorization to reuse its host or network.
2. Establish restricted runtime PostgreSQL access and separate migration/verifier
   authority, verify TLS and native identity/RLS/concurrency tests. Keep the Node
   server private. Check source SHA and migration digests through the private
   operator path; do not expose health/admin paths through this gateway.
3. Verify actual workerd -> VPC Service -> TLS -> Node -> PostgreSQL transport.
   Local synthetic HTTP bindings do not exercise a real Tunnel, TLS verification,
   VPC destination enforcement, database or independently controlled authority.
4. Exercise forged Origin/bearer, missing dependencies, target mismatch, backend
   denials, cross-session access, stale/revoked authority, logout/cancel, privacy
   export release and COMMIT disconnects. No automatic command retry.
5. Obtain exact-head CI, protected release approval, data-minimized observability,
   target/rollback identities and budget approval before changing either mode.

Cloudflare describes VPC as free while in beta, not permanently free. Worker CPU
and external Node/database costs remain separate; actual account billing and
remaining budget have not been verified. This code creates no billable resource.

Official capability references (checked 2026-11-12):
- https://developers.cloudflare.com/workers-vpc/api/
- https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/
- https://developers.cloudflare.com/workers-vpc/configuration/vpc-networks/
- https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/
