# CanopyProof Phase R0 Integration Recovery Report

Status: R0 clean baseline assembled; production release not authorized
Report date: 2026-07-28

## Decision

The approved CanopyProof recovery scope was replayed into isolated detached
worktrees as an atomic commit chain. The integration content tip is:

`6a7ec9443bee970779c2a6521e7320dd5de37df1`

The integration base is:

`41d7e423ac911a412be30c0fb6f481c99ddeefe7`

This report and the other final R0 evidence documents are carried by a
documentation-only commit on top of the integration content tip. No branch was
pushed, no deployment workflow was invoked, and no production state was
changed.

R0 establishes a reproducible engineering baseline. It does not establish
production readiness: the critical-module coverage gate and the cold-start
WebGL fallback gate remain open.

## Recovery Boundary

| Item | Result |
| --- | --- |
| Dirty source root | `/Users/lee/Dropin/dropin-earth` |
| Dirty source branch | `canopyproof/edge-security-hardening` |
| Integration worktree | `/tmp/canopyproof-industrial-integration` |
| Final replay worktree | `/tmp/canopyproof-final-replay` |
| Destructive cleanup | Not used |
| Bulk staging or bulk copy | Not used |
| Remote push or deploy | Not performed |
| Production reports | Excluded |
| Secret-bearing files | Excluded without reading values |

The dirty tree was inventoried before integration. Approved files were replayed
by explicit subsystem boundaries. The recovery process did not use
`git reset --hard`, `git clean -fd`, `git add .`, `git commit -a`, or a force
push.

## Disposition Ledger

The authoritative path ledger is
`docs/WORKING_TREE_FILE_DISPOSITION.csv`.

| Disposition | Paths |
| --- | ---: |
| Included and reviewed | 436 |
| Explicitly excluded | 636 |
| Actual base-to-evidence changed paths | 435 |

The difference is intentional:
`apps/web/postcss.config.mjs` was reviewed and admitted from the dirty snapshot,
but its approved content is byte-equivalent to the committed base and therefore
creates no Git delta.

Four files created by exact clean-replay dependency repair were added to the
ledger after the initial dirty-tree snapshot:

- `apps/admin/package.json`
- `apps/miniapp-ton/package.json`
- `apps/web/eslint.config.mjs`
- `eslint.config.mjs`

Every included row now names the commit that last changed the path and records
`clean_replay_passed`. The four evidence files carried by the final report
commit use the explicit symbolic target `FINAL_EVIDENCE_COMMIT`; that symbol
means the commit containing the ledger and reports, avoiding an impossible
self-referential Git hash.

### Included Subsystems

| Slice | Paths |
| --- | ---: |
| A architecture and RFCs | 51 |
| B deterministic satellite proof | 19 |
| C global command center | 29 |
| D mobile evidence vault | 5 |
| E mobile sync authority | 19 |
| F verify-only security | 15 |
| G evidence orchestration | 82 |
| H trust kernel and PostgreSQL | 116 |
| I validation and coverage | 85 |
| R0 recovery evidence | 7 |
| S shared build plumbing | 8 |

### Excluded Families

The 636 excluded paths remain individually recorded. Major excluded classes are:

- linked-worktree and duplicate repository families;
- generated, cache, test-output, and runtime state;
- `.env*`, private-key filename classes, and production reports;
- deployment, testnet, mainnet, legacy automation, and production E2E paths;
- unrelated product, miniapp, contract, protocol, service, and Dropin prototypes;
- files outside the intended `dropin-earth` source root.

## Duplicate And Artifact Findings

Duplicate logical source families were found under:

- `.codex-worktrees/canopyproof-jpg-logo-deploy/`;
- `.codex-worktrees/canopyproof-svg-deploy/`; and
- `canopyproof-spatial-grid-tree/`.

They were never used as integration sources. No nested
`dropin-earth/dropin-earth` source tree and no competing root `apps/web` source
tree was admitted.

Ignored or generated descendants included `node_modules`, `.next`,
`.open-next`, `.wrangler`, coverage output, report output, SQLite runtime state,
and OS caches. None is part of the commit chain.

The final candidate-source secret marker scan reported:

`SECRET_MARKER_FINDINGS=0`

The scan reported marker locations only and did not print or retain secret
values. Private-key files and unrelated environment files were not opened.

## Atomic Commit Chain

| Commit | Purpose |
| --- | --- |
| `738fedc0be95` | inventory recovery boundary |
| `5017e4586a9c` | architecture and production contracts |
| `81928fd0a555` | harden integration slices |
| `b317711e8982` | append-only trust kernel |
| `d55f45a16f87` | refine evidence dependencies |
| `1ec07a12900d` | restore shared UI exports |
| `8b9405d4c3fb` | governed evidence orchestration |
| `b18676768964` | isolate mobile route composition |
| `327a474f50df` | encrypted mobile evidence vault |
| `08b7140dbbe0` | governed mobile evidence admission |
| `72cc74104ebb` | exclude mixed hooks prototype |
| `dcdd3d9ee5bb` | defer native RLS gate to clean replay |
| `d9d56ad22b98` | governed global projection |
| `b75b9b5c55ce` | admit hardened Cloudflare package |
| `9deddcc1cbc3` | verify-only edge observability |
| `65b50c2893ad` | deterministic satellite proof |
| `2c40ac179c8e` | finalize composition boundary |
| `a4e20488d75c` | compose institutional baseline |
| `3a1370c9c0e0` | restore deterministic clean replay |
| `5a32a57fdbd7` | clear dependency audit |
| `6a7ec9443bee` | verify effective device projection parity |

No commit mixes excluded product prototypes, deployment activation, or
production evidence into the R0 baseline.

## Preserved Safety Contracts

- `CANOPY_PRODUCTION_UNLOCK` remains disabled.
- Mobile production sync remains disabled.
- Satellite adapters remain deterministic mock or fixture adapters.
- KMS capability remains verify-only; no signing authority was introduced.
- Critical CanopyProof writes do not synchronously depend on Dropin.
- Agents cannot become final approval authority.
- API and Web Workers remain separate.
- Admin proxying remains blocked.
- No mainnet funds, automatic CANOPY distribution, certified carbon-credit
  claims, carbon-tax offset claims, or guaranteed-yield claims were enabled.

## Remaining Risks

1. `test:coverage:critical` is specified by policy but is not implemented in
   `package.json`; the command fails closed as a missing script.
2. Clean repository coverage passes the bootstrap ratchet but not all Gate 1
   dimensions, and critical authority modules have not demonstrated 95 percent
   coverage in all dimensions.
3. Desktop and mobile WebGL behavior passed, but cold-start browser behavior
   with WebGL unavailable remains unverified. Live context loss does not switch
   to the static fallback.
4. The chain is detached from a stale local base. Remote reconciliation and
   human review must happen in a separate, non-force-push change-management
   step.

## Recommended Next Phase

Implement and enforce the critical-module coverage gate, add a deterministic
browser test for WebGL-unavailable and context-loss behavior, then review and
replay this chain onto the current authoritative remote branch. Production
unlock, release approval, push, and deployment remain separate human-governed
operations.
