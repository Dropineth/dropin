# CanopyProof R1 Commit Chain Verification

Status: PASS

Verification date: 2026-07-28

## Verified Objects

| Role | Commit |
| --- | --- |
| R0 integration content | `6a7ec9443bee970779c2a6521e7320dd5de37df1` |
| R0 evidence | `7f7729c567016ed0eff92b7db61e41bcc57b2285` |

Both objects exist in the local repository. Git confirms that the integration
content commit is an ancestor of the evidence commit.

## Evidence Commit Scope

The evidence commit contains exactly four documentation changes:

| Status | Path | Explanation |
| --- | --- | --- |
| Added | `docs/CANOPYPROOF_CLEAN_REPLAY_REPORT.md` | clean replay evidence |
| Added | `docs/CANOPYPROOF_INTEGRATION_RECOVERY_REPORT.md` | integration recovery evidence |
| Added | `docs/CANOPYPROOF_RELEASE_CANDIDATE_MATRIX.md` | release gate decision |
| Modified | `docs/WORKING_TREE_FILE_DISPOSITION.csv` | binds included paths to atomic commits |

There are no application, service, package, workflow, migration, test, build,
or runtime changes in the evidence commit.

## Deleted File Audit

The prompt-derived parent of the final integration content commit is
`5a32a57fdbd75b6542a0a23ebbab181f785acc41`. Its one-commit diff to
`6a7ec9443bee970779c2a6521e7320dd5de37df1` contains zero deletions.

That adjacent diff is too narrow to audit the full R0 chain. The recovery
report identifies the true R0 base as
`41d7e423ac911a412be30c0fb6f481c99ddeefe7`; the full base-to-integration diff
also contains zero deletions. `docs/R1_DELETED_FILE_DISPOSITION.csv` therefore
contains only its schema header.

Targeted review confirmed:

| Path family | R0 disposition |
| --- | --- |
| `CanopyProofOSPage.tsx` | added |
| `canopyproof-os.ts` | added |
| `siteContent.ts` | modified in place |
| approved route page shells | retained or added; none deleted |
| `worker-configuration.d.ts` | absent from both base and integration; no tracked deletion |
| committed tests | retained or added; none deleted |
| `packages/dropin-protocol` | added |
| `integrations/fiftyone` | added |
| native PostgreSQL tests | added |

There is no `ACCIDENTAL_DELETION` or `UNRESOLVED` entry.

## Commands

```bash
git show --no-patch --format=fuller \
  6a7ec9443bee970779c2a6521e7320dd5de37df1

git show --no-patch --format=fuller \
  7f7729c567016ed0eff92b7db61e41bcc57b2285

git merge-base --is-ancestor \
  6a7ec9443bee970779c2a6521e7320dd5de37df1 \
  7f7729c567016ed0eff92b7db61e41bcc57b2285

git diff-tree --no-commit-id --name-status -r \
  7f7729c567016ed0eff92b7db61e41bcc57b2285

git diff --diff-filter=D --name-only \
  41d7e423ac911a412be30c0fb6f481c99ddeefe7 \
  6a7ec9443bee970779c2a6521e7320dd5de37df1
```

## Decision

The R0 chain is internally consistent and is a valid base for isolated R1
hardening. This verification does not authorize push, deployment, production
unlock, or production evidence changes.
