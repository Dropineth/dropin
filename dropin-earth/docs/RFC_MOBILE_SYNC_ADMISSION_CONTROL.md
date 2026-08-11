# RFC: Mobile Evidence Sync Admission Control

Status: accepted; default-closed foundation implemented, activation pending

Date: 2026-07-17

Owners: CanopyProof Evidence Protocol, Security, and Field Operations

## Problem Statement

The mobile evidence sync authority authenticates organization members, validates
strict request schemas, and commits evidence through serializable append-only
authorities. It does not yet bound request frequency or request-body size across
multiple API instances. A process-local token bucket would split under horizontal
scaling and would reset on restart. Trusting a caller IP would also create a weak
identity boundary and unnecessary location/privacy metadata.

The command routes must remain closed until a shared, fail-closed admission
authority can reject abusive traffic before evidence parsing or durable command
execution.

## Decision

Add a PostgreSQL-backed admission authority for `binding`, `batch`, and
`recovery` commands.

- Fixed one-minute windows are keyed by organization, actor, command, and scope.
- Organization and actor counters are advanced in one serializable transaction.
- Locks are always acquired organization-first and actor-second.
- Every authenticated, body-bounded command attempt that reaches admission
  consumes capacity, including exact command retries.
- Mutable counters are operational coordination state, not evidence or trust
  authority.
- A denied attempt appends an immutable, tenant-scoped denial fact with a
  deterministic root.
- Allowed attempts return bounded rate metadata but do not create an unbounded
  append-only event stream.
- No client IP, request body, coordinates, media metadata, raw idempotency key,
  credential, token, or private key is stored in either relation.

The v1 policy is deliberately conservative:

| Command | Actor requests/minute | Organization requests/minute | Body limit |
| --- | ---: | ---: | ---: |
| `binding` | 30 | 300 | 16 KiB |
| `batch` | 12 | 120 | 256 KiB |
| `recovery` | 30 | 300 | 4 KiB |

Changing limits requires a new reviewed policy version. Environment variables
cannot silently alter these values.

## Trust Model

Admission input is derived only after the existing Access JWT and PostgreSQL
authorization binding have established the actor and organization. The route
supplies the command type and a server timestamp. The authority derives the
window and policy limits.

The database is authoritative for counters and denial facts. The HTTP response
is advisory operational metadata and cannot verify evidence, resolve a challenge,
issue a certificate, authorize funds, or unlock CANOPY.

## Data Flow

```text
bounded request-body stream
  -> Access JWT + PostgreSQL membership
  -> mobile feature and governance gates
  -> durable command and admission authorities available
  -> SERIALIZABLE organization/actor window consumption
  -> deny with 429 + Retry-After + immutable denial root
     or
  -> strict Zod parse
  -> existing mobile evidence command authority
```

Database failure, missing migration, invalid decision shape, or missing durable
admission provider returns `503`; the command service is not invoked.
Oversized or unbounded streams are rejected before authentication and admission
to cap memory consumption. They do not create database denial facts; Cloudflare
edge rules and edge telemetry must count and suppress that traffic before it
reaches Worker or origin compute.

## Threat Model

The control addresses:

- concurrent requests crossing API instances;
- actor fan-out within one organization;
- retries used to bypass process-local quotas;
- chunked requests without `Content-Length`;
- oversized batch and recovery bodies;
- attacker-controlled IP rotation;
- forged rate metadata or denial roots;
- cross-tenant reads and writes;
- mutation or deletion of historical denial facts.

It does not replace Cloudflare WAF/rate rules, bot management, request timeout,
queue backpressure, malware scanning, field-device attestation, privacy review,
or incident response. Distributed denial-of-service protection must still begin
at the Cloudflare edge before origin compute is consumed.

## API Design

The existing routes and response bodies remain stable. Command responses add
standardized operational headers:

```text
RateLimit-Limit
RateLimit-Remaining
RateLimit-Reset
Retry-After              # denied requests only
CanopyProof-Abuse-Event-Root  # denied requests only
```

`CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED=true` becomes an additional required
activation gate. The flag defaults to false and is insufficient by itself: the
durable provider must also resolve successfully.

Oversized bodies return `413 CANOPYPROOF_MOBILE_SYNC_BODY_TOO_LARGE`. Exhausted
budgets return `429 CANOPYPROOF_MOBILE_SYNC_RATE_LIMITED`. Authority failures
return `503 CANOPYPROOF_MOBILE_SYNC_ADMISSION_UNAVAILABLE`.

## Database Changes

Add:

- `audit.mobile_sync_admission_buckets`: mutable, tenant-scoped operational
  counters keyed by scope and fixed window;
- `audit.mobile_sync_admission_denial_facts`: append-only, tenant-scoped denial
  records with SQL-recomputed deterministic roots.

Both relations use forced row-level security. Denial facts reject update/delete
and are included in the database mutation audit. Buckets contain no canonical
evidence or authorization state.

## Migration Strategy

1. Apply `canopyproof-os.sql`.
2. Apply `mobile-sync-admission.sql` additively.
3. Run PGlite schema/root/tamper/RLS tests. This gate passes locally.
4. Run native PostgreSQL dual-connection contention tests. A disposable
   PostgreSQL 17.10 run proves that concurrent requests 30 and 31 produce one
   allow and one immutable denial, while request 32 remains denied.
5. Keep `CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED=false` until edge WAF,
   operations, privacy, and incident-response reviews are complete.

No existing evidence, local draft, command receipt, or E4 fact is migrated.

## Rollback Strategy

Disable the admission flag and the mobile sync feature flag first. The rollback
script may remove empty relations. If any denial fact or bucket exists, rollback
fails closed so operational evidence is not silently destroyed. Production data
requires governed retention/export and forward remediation.

Rollback never falls back to a process-local limiter or the legacy evidence
network.

## Safety Boundary

Admission is an abuse-control prerequisite only. It makes no environmental,
carbon-credit, tax-offset, ownership, financial-asset, or yield claim. It moves
no funds, distributes no CANOPY, handles no private key, and does not change the
separation between API and Web Workers or the `/api/admin/*` block.
