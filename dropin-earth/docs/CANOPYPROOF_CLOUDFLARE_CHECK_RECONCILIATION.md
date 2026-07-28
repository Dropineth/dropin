# CanopyProof Cloudflare Check Reconciliation

Status: ADMIN_ACTION_REQUIRED

Inspection date: 2026-07-29

Product PR: [Dropineth/dropin#2](https://github.com/Dropineth/dropin/pull/2)

Observed PR head: `baf1695239c439a17398c4406b3362e073fbd7a5`

The current PR check page shows two Cloudflare failures and the passing
CanopyProof Trust Gate. No check is removed or reclassified in GitHub by this
document.

## Observed Checks

| Check | GitHub App | Check ID | Associated SHA | Cloudflare project | Details | Branch mapping | Required-check status | Classification |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| `Workers Builds: canopyproof-web` | Cloudflare Workers and Pages (`cloudflare-workers-and-pages`) | `90322038514` | `baf1695239c439a17398c4406b3362e073fbd7a5` | `canopyproof-web` | [build `f16c287d-388a-49ba-b3fd-e3bac6be4958`](https://dash.cloudflare.com/ff1026248646a5c87b3a664d87683818/workers/services/view/canopyproof-web/production/builds/f16c287d-388a-49ba-b3fd-e3bac6be4958) | PR-head check on `canopyproof/industrial-rc1`; Cloudflare dashboard production branch mapping requires admin confirmation | UNVERIFIED; branch-protection details are admin-only | `STALE_SUPERSEDED` |
| `Workers Builds: dropin` | Cloudflare Workers and Pages (`cloudflare-workers-and-pages`) | `90321974466` | `baf1695239c439a17398c4406b3362e073fbd7a5` | `dropin` | [build `72ad36c0-fd1d-49a8-bd07-5af2bee0749a`](https://dash.cloudflare.com/ff1026248646a5c87b3a664d87683818/workers/services/view/dropin/production/builds/72ad36c0-fd1d-49a8-bd07-5af2bee0749a) | PR-head check on `canopyproof/industrial-rc1`; project-to-branch mapping requires admin confirmation | UNVERIFIED; branch-protection details are admin-only | `ORPHANED` |

Both failures completed in zero seconds on the current evidence SHA. The
`canopyproof-web` check belongs to a legacy direct Workers Builds path that
does not implement immutable target/evidence binding or protected staging
review. It is superseded for staging by the CanopyProof Trust Gate plus the
main-owned protected staging workflow. The `dropin` check targets a legacy
project identity rather than either approved staging Worker and is classified
as orphaned from the CanopyProof staging release.

These classifications concern release authority, not the unseen Cloudflare
build log. If the Cloudflare dashboard shows a real source or build defect
shared by the protected staging path, reclassify the affected check as
`REAL_BUILD_FAILURE` and fix that defect before staging.

## Preserved Authoritative Gate

`CanopyProof Trust Gate` run
[30373113325](https://github.com/Dropineth/dropin/actions/runs/30373113325)
passed on the evidence SHA. The proposed staging workflow adds an independent
protected deployment gate on `main`; it does not replace code review or the
Trust Gate.

## Administrator Reconciliation

After the control-plane PR is merged, a repository and Cloudflare
administrator must:

1. inspect both Cloudflare build logs and project branch mappings;
2. verify whether either check name is configured as a required `main` status
   check;
3. preserve the CanopyProof Trust Gate as required;
4. disconnect `canopyproof/industrial-rc1` from the legacy direct production
   Workers Builds path;
5. remove only `Workers Builds: dropin` and, after confirmation,
   `Workers Builds: canopyproof-web` from required branch protection if they
   are stale/orphaned and superseded;
6. keep the Cloudflare GitHub App installed if another valid project depends on
   it;
7. record the branch-protection change and Cloudflare project change in an
   administrator audit note.

Do not dismiss a real build failure, disable all Cloudflare checks, remove the
Trust Gate, or grant a PR-authored workflow staging secrets. No change is
authorized until an administrator confirms the required-check status.
