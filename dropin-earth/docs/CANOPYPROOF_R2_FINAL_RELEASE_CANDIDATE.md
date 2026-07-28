# CanopyProof R2 Final Release Candidate

Status: REMOTE REVIEW PENDING

Final state: `NOT_PRODUCTION_READY`

Report date: 2026-07-28

This report records engineering evidence for the exact deployable candidate. It
does not approve a merge, staging deployment, production deployment, protocol
write, financial action, or environmental claim.

## Candidate Identity

| Role | Commit |
| --- | --- |
| R1 remote candidate before final gates | `e2a0b17914f4418643a76c20b4c2232f184b228f` |
| Cross-browser WebGL gate | `cfaf48a` |
| Cross-browser CI isolation fix | `a2d48748e49ffb44e9f0b0f45099a30804d7cdd8` |
| Final deploy target | `a2d48748e49ffb44e9f0b0f45099a30804d7cdd8` |
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
| Locked install | PASS; 725 packages added, 736 audited |
| Supply-chain inventory | PASS; 711 CycloneDX components |
| Secret marker scan | PASS; 0 findings |
| Tracked generated artifact scan | PASS; 0 findings |
| Lint | PASS |
| Typecheck | PASS |
| TypeScript unit tests | PASS; 831/831 |
| FiftyOne tests | PASS; 4/4 |
| PGlite integration | PASS; 40/40 |
| Workspace build | PASS |
| Moderate dependency audit | PASS; 0 vulnerabilities |
| Repository coverage | PASS; 83.06/76.90/83.34/83.06 |
| Critical coverage | PASS; every configured module at least 95% in all dimensions |
| Chromium WebGL | PASS; 9 scenarios |
| Firefox fallback | PASS; 4 scenarios |
| WebKit fallback | PASS; 6 scenarios |
| Browser skips | 0 |
| OpenNext Cloudflare build | PASS |
| Local workerd smoke | PASS; 15/15 routes |

The repository coverage order is statements, branches, functions, and lines.
The enforced floors are 70, 72.75, 70, and 70 percent respectively.

GitHub Trust Gate run
[30370082728](https://github.com/Dropineth/dropin/actions/runs/30370082728)
passed the deterministic workspace gate, native PostgreSQL 17.10 (2/2),
repository coverage, and critical coverage. Its browser step then exposed a
test-isolation defect: transient SwiftShader availability masked the injected
dynamic-import failure with an earlier WebGL preflight failure. OpenNext and
workerd were skipped by fail-fast after that browser failure.

The final deploy target makes chunk failure and timeout scenarios independent
of transient CI GPU availability while retaining separate real-rendering,
context-unavailable, and context-loss scenarios. The official Playwright
Chromium, Firefox, and WebKit matrix passed 19/19 locally after the fix.
Native PostgreSQL passed on the immediate remote ancestor, but it must run
again on this exact candidate in the GitHub Trust Gate before the PR can become
ready for review; the ancestor result is not represented as exact-target
evidence.

## Critical Coverage

| Module | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Satellite state machine | 99.92% | 98.18% | 100.00% | 99.92% |
| Satellite schemas and root builder | 100.00% | 96.88% | 100.00% | 100.00% |
| Deterministic satellite adapters | 100.00% | 100.00% | 100.00% | 100.00% |
| Mobile evidence vault | 98.34% | 96.58% | 100.00% | 98.34% |
| Mobile sync authority | 99.77% | 96.00% | 100.00% | 99.77% |
| Security authorization | 99.46% | 97.68% | 100.00% | 99.46% |
| KMS verify-only | 98.92% | 97.01% | 100.00% | 98.92% |
| Metadata extraction | 99.38% | 96.71% | 100.00% | 99.38% |
| Effective-media orchestration | 100.00% | 97.96% | 100.00% | 100.00% |
| Audit and challenge invariants | 99.81% | 96.63% | 100.00% | 99.81% |
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

1. The Draft PR must run the Trust Gate against the pushed final RC evidence
   tip, including native PostgreSQL 17.10.
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
