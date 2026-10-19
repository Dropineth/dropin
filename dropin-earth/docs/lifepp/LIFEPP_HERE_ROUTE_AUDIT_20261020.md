# Life++HERE presentation and business-entry audit

Audit baseline: `Dropineth/dropin@be057475fcd40ca18b58b430eb88e811a9bdbde2`.
Application: `dropin-earth/apps/web`, Next.js App Router, deployed brand domain `canopyproof.org`.
This document is a source audit and implementation handoff, not deployment or acceptance evidence.

## Confirmed route structure

`src/app/life/[[...path]]/page.tsx` resolves through `LifeRoute` and `data/life/navigation.ts`:
- `/life`, `/life/spaces`, `/life/center`, `/life/agents`, `/life/membership`, `/life/partners`, `/life/trust`.
- `/life/spaces/33` and `/life/spaces/29` are primary test-source records; `/life/spaces/31` is retained history.
- Life/company canonical metadata declares `/en/life/**` and `/en/company`; retain existing language paths and verify them in browser acceptance.
- `/life/inquiries` and `/life/inquiries/maintenance` are separate handlers, not presentation pages. Do not modify them in these PRs.
- `/` is the planetary overview. `/earth` and `/evidence` are existing reference/presentation routes. `/ecology` renders `CanopyProofLanding`, which uses `BrandSwitcher`.
- The ecology switcher's old `/#top` target incorrectly conflates that page with the planetary root. The new explicit `/ecology` entry does not alter either route or any old anchor.

## Independent changes

1. Public brand shell and SEO: central `Life++HERE` presentation name; preserve legal entity, membership tier IDs and protocol identifiers. Finish remaining page/body/structured-data strings before claiming a sitewide migration.
2. Existing scene viewer lifecycle: invalidate consent/session/error state on source, asset or permission revisions. No new renderer, package or asset is authorized.
3. Business switcher: typed same-origin read-only destinations; reuse the same byte-identical public-brand module so this branch can be reviewed independently of the brand-shell branch.

## Source content follow-through still required

The active source still describes the older four-unit 671.26 m² pilot. The user's 2026-10-19 public planning brief specifies three units (L112 58.69 m², L203 135.80 m², L202 185.99 m²; total 380.48 m², second floor 321.79 m²), excluding L201 from this phase. A complete, separately tested content migration must update the manifest, Life pages, floorplan selection, spatial demonstration model, planetary anchors and tests together. Do not change just the headline or relabel the original floorplan as a new survey.

L112 is the planned robot hangar; L203 is experience/spatial capture/equipment demonstration and enquiries; L202 is digital agents, shared learning and community/lifestyle experiences. Site rights, safety acceptance, operating status and capture rights are not established by this brief. Do not publish the uploaded confidential financing, lease or profit-sharing documents to the public repository.

## Existing safety and release boundaries

Three.js, React Three Fiber and Drei already exist in the web dependency graph. Reuse the locked stack; no speculative dependency installation is needed for this batch.

`docs/ADR_SPATIAL_STACK.md` remains PROPOSED with its implementation gate CLOSED. These changes do not approve TerraProof services, migrations, signed-manifest routes or a new production spatial viewer. Registered third-party 3DGS scenes remain blocked, with no verified HTTPS embed, no scene-to-room mapping and no navigation acceptance.

The production release workflow is separately dispatched and requires an exact reviewed SHA, same-SHA CI, independent approval and a real rollback target. Do not merge, dispatch deployment, change Cloudflare/DNS/credentials, or relax this gate from these tasks. Preserve all disabled billing, robot-control, RWA, training-data sale and carbon-credit flags.

## Required acceptance

Run existing typecheck, lint, Life++ unit tests, build, Trust gate, viewer lifecycle fixtures, and Chromium/Firefox/WebKit route acceptance. Add actual same-ID viewer revocation/version browser tests, bilingual navigation and mobile layout checks. Record exact commit/run IDs and actual results. A queued workflow is not a pass; a fixture rendering is not a real 3DGS capture or certified ecological evidence.
