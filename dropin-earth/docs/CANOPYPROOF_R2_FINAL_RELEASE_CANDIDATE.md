# CanopyProof R2 Final Release Candidate

Status: REMOTE REVIEW PENDING

Final state: `NOT_PRODUCTION_READY`

Report date: 2026-08-11

This report records engineering evidence for the exact deployable candidate. It
does not approve a merge, staging deployment, production deployment, protocol
write, financial action, or environmental claim.

## Candidate Identity

| Role | Commit |
| --- | --- |
| Prior validated deploy target | `a2d48748e49ffb44e9f0b0f45099a30804d7cdd8` |
| Prior RC evidence | `baf1695239c439a17398c4406b3362e073fbd7a5` |
| Supply-chain hardening | `8272274d5f35e72ebbb53b9a9d25e907aeeb9e58` |
| Final deploy target | `8272274d5f35e72ebbb53b9a9d25e907aeeb9e58` |
| Final RC evidence | the documentation-only commit containing this report |

- Remote branch: `canopyproof/industrial-rc1`
- Draft PR: [Dropineth/dropin#2](https://github.com/Dropineth/dropin/pull/2)
- Base branch: `main`
- Merge strategy: preserve reviewed commit identity; no force push

The final deploy target includes all code, tests, workflows, staging
configuration, and release gates. The following documentation-only commit is
not a deployment target.

## Exact-Target Validation

Validation ran in a detached clean worktree created from the full 40-character
final deploy target. Dependencies were installed from the lockfile with npm
10.9.4.

| Gate | Result |
| --- | --- |
| Locked install | PASS; npm 10.9.4, optional dependencies included |
| Supply-chain inventory | PASS; 718 CycloneDX components |
| Secret marker scan | PASS; 0 findings |
| Tracked generated artifact scan | PASS; 0 findings |
| Lint | PASS |
| Typecheck | PASS |
| TypeScript unit tests | PASS; 831/831 |
| FiftyOne tests | PASS; 4/4 |
| PGlite integration | PASS; 40/40 |
| Workspace build | PASS |
| Moderate dependency audit | PASS; 0 vulnerabilities |
| Repository coverage | PASS; 83.83/76.81/85.51/83.83 |
| Critical coverage | PASS; every configured module at least 95% in all dimensions |
| Chromium WebGL | PASS; 9 scenarios |
| Firefox fallback | PASS; 4 scenarios |
| WebKit fallback | PASS; 6 scenarios |
| Browser skips | 0 |
| OpenNext Cloudflare build | PASS |
| Local workerd smoke | PASS; 15/15 routes |
| Native PostgreSQL 17.10 | PASS; 2/2 on a disposable loopback-only cluster |

The repository coverage order is statements, branches, functions, and lines.
The enforced floors are 70, 72.75, 70, and 70 percent respectively.

The final deploy target includes the WebGL isolation fix and updates only the
audited dependency graph and its version-lock contract. The official Playwright
Chromium, Firefox, and WebKit matrix passed 19/19 locally. A disposable
loopback-only PostgreSQL 17.10 instance passed the two native tests for forced
RLS and multi-connection atomicity, then was stopped and removed. Remote Trust
Gate execution on this exact target remains mandatory before review promotion.

## Supply-Chain And Artifact Evidence

| Artifact | SHA-256 or identity |
| --- | --- |
| Git tree | `9c06adfb5b53fb3172c9aceddc084800fc1e93a6` |
| Tracked source listing | `1b453e3103c2dd1a8e09d013ca6c286d58bee194561e9bbeade009d82ba94833` |
| Package lock | `54dbdbc9fa938fbf5287e335c5ff0d93a0232332c7792854e9cee596d7e1b4de` |
| OpenNext Worker | `d05223bf4d44c84108a102ab62aa3bc9c5568f0c3ac2064c37be5cc65c64bc45` |
| Static asset manifest, 70 files | `03d328369d0659a2d68fa48c16852e6c2736247669a31bb0898b46e190d5fe8c` |
| Migration manifest, 49 SQL files | `b99764790a2ad4c06299c89421bfb86ee50fcaddd16d4bc29e503aee8e898360` |
| Test evidence bundle | `3e1b777bcc13adde23465fa85c32c48e1521e448e9bf19e9ada4f1ae2ef2e631` |

The CycloneDX SBOM, supply-chain gate, static asset list, migration list, test
bundle, and release manifest are stored under `reports/ci`. They contain no
credentials and introduce no signing key.

## Critical Coverage

| Module | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Satellite state machine | 99.92% | 98.18% | 100.00% | 99.92% |
| Satellite schemas and root builder | 100.00% | 96.88% | 100.00% | 100.00% |
| Deterministic satellite adapters | 100.00% | 100.00% | 100.00% | 100.00% |
| Mobile evidence vault | 98.34% | 96.55% | 100.00% | 98.34% |
| Mobile sync authority | 99.77% | 95.95% | 100.00% | 99.77% |
| Security authorization | 99.46% | 97.67% | 100.00% | 99.46% |
| KMS verify-only | 98.92% | 97.01% | 100.00% | 98.92% |
| Metadata extraction | 99.38% | 96.72% | 100.00% | 99.38% |
| Effective-media orchestration | 100.00% | 97.96% | 100.00% | 100.00% |
| Audit and challenge invariants | 99.81% | 96.62% | 100.00% | 99.81% |
| Global spatial disclosure | 99.77% | 96.03% | 100.00% | 99.77% |

## Runtime Evidence

The browser matrix executes without silent skips. It covers WebGL absence,
null canvas context, dynamic import failure, chunk and first-frame deadlines,
context loss, one bounded retry, reduced motion, mobile viewport behavior,
late-module duplicate-renderer prevention, accessible fallback content,
generalized-coordinate privacy, and withheld-region preservation.

The OpenNext bundle contains the Worker, assets, promoted static homepage, and
RSC asset. Local workerd verifies all required public routes, the production
JPEG assets, sitemap coverage, and the intentional `/icon.svg` 404.

## Safety Boundaries

- `CANOPY_PRODUCTION_UNLOCK=false`
- `DROPIN_ALLOW_ADMIN_PROXY=false`
- production mobile sync remains disabled
- real satellite writes remain disabled
- KMS remains verify-only; no private signing key is configured
- API and Web Workers remain separate
- mainnet funds remain disabled
- automatic CANOPY distribution remains disabled
- certified carbon-credit claims remain disabled
- carbon-tax offset claims remain disabled
- guaranteed-yield claims remain disabled
- agents and AI cannot become final approval authority

## Open Remote Gates

1. The Draft PR must run the Trust Gate against the pushed final deploy target
   and following evidence tip, including native PostgreSQL 17.10.
2. Required branch checks and independent human review must pass before merge.
3. GitHub Environment `canopyproof-staging` is not configured. The repository
   currently exposes only the protected production environment.
4. Staging requires isolated PostgreSQL, object storage, telemetry, API origin,
   Cloudflare credentials, a protected resource-manifest digest, and independent
   required reviewers.
5. Staging smoke, security, load, backup/restore, failure injection, and the
   minimum 12-hour soak have not run.

No staging label or workflow dispatch is authorized until the protected staging
environment and isolated resources exist. No production workflow is authorized
in R2.

## Decision

The remaining R2 engineering gates are implemented and pass locally on the
exact deploy target. The release remains:

`NOT_PRODUCTION_READY`

The next valid transition is remote Trust Gate completion and independent PR
review, followed by protected isolated staging. It is not production approval.
