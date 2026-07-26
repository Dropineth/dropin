# NASA Worldview Upstream Policy

Status: PROPOSED

Date: 2026-07-14

## 1. Decision

CanopyProof will integrate directly with documented NASA GIBS services through
its own bounded connector and approved MapLibre/deck viewer. It will not fork,
vendor, embed, or redistribute the complete NASA Worldview application in this
phase.

Worldview remains an upstream reference implementation and an external deep
link destination.

## 2. Rationale

Worldview is a mature OpenLayers application with its own configuration,
deployment, data download, event, projection, state, and plugin behavior.
Embedding it would create a second application runtime and authority surface
inside CanopyProof. Forking it would also introduce NASA Open Source Agreement
1.3 redistribution and modification obligations unrelated to the narrower GIBS
connector.

NASA's official embedding documentation states that embedding on non-NASA
sites is disabled by default and requires contacting NASA. Therefore no iframe
is permitted without explicit written NASA approval and a separate security,
privacy, accessibility, and governance review.

## 3. Permitted Upstream Use

- read public Worldview source and documentation for interoperability research;
- link users to `https://worldview.earthdata.nasa.gov/` using a constrained,
  locally generated query containing only approved layer/date/view state;
- monitor stable Worldview releases and GIBS documentation changes;
- compare CanopyProof behavior against documented GIBS semantics;
- report upstream defects without sharing CanopyProof secrets or tenant data.

## 4. Prohibited Upstream Use

- copying Worldview source, configuration, icons, branding, or bundled assets;
- importing Worldview modules into CanopyProof;
- embedding Worldview without NASA permission;
- representing CanopyProof as an official NASA application or partner;
- automatically tracking an unpinned Worldview branch in production;
- forwarding precise restricted project locations in a Worldview URL;
- treating Worldview events, labels, screenshots, or state as proof records;
- using NASA names or marks to imply endorsement.

## 5. NASA-1.3 Boundary

Worldview is distributed under NASA Open Source Agreement 1.3. If a future
decision copies or modifies any covered source, the legal and engineering
review must address at least:

- inclusion of the NASA agreement with distributions;
- source availability for non-source distributions;
- required copyright notice;
- identification and dating of modifications and their originator;
- preservation of prior notices;
- non-endorsement language;
- larger-work and sublicense obligations;
- export-control notice and warranty/liability terms.

No such reuse is approved by this policy. Calling documented public GIBS APIs
and linking to Worldview does not copy Worldview source.

## 6. Version and Change Management

Current review baseline (2026-07-14): Worldview release `v4.100.1`, published
2026-07-06, plus the `main` branch configuration, URL-parameter, embedding, and
license documentation reviewed on that date. This is a compatibility record,
not a runtime dependency or permission to auto-upgrade.

Maintain an upstream register containing:

- reviewed Worldview release/tag and review date;
- reviewed GIBS documentation revision/date;
- supported GIBS service versions and projections;
- capabilities schema fixtures and source hashes;
- known breaking changes, outages, and deprecations;
- owner and next review date.

Automated monitoring may open an internal review issue, but may not update
production endpoint registries, parser behavior, map templates, or attribution
without a reviewed change. Major Worldview versions and GIBS schema changes
require regression tests and a new compatibility decision.

## 7. Deep-Link Policy

The `open in Worldview` action is a normal external link, not an iframe. The
link builder must:

- use the exact HTTPS Worldview origin;
- encode only approved NASA layer IDs, date/time, projection, and generalized
  view state;
- reject arbitrary query keys, fragments, redirects, and caller URLs;
- omit tenant, actor, evidence, device, credential, and restricted-location
  identifiers;
- display that the destination is an external NASA service.

## 8. Upstream Contribution Policy

Any proposed contribution to Worldview must be isolated from CanopyProof
proprietary credentials, tenant data, and internal architecture. Contributions
require maintainer review, a signed-off provenance statement, tests, and legal
confirmation that the contributor can grant the required rights. Upstream
acceptance does not authorize a CanopyProof production upgrade.

## 9. Review Trigger

Revisit this policy if NASA grants embedding permission, CanopyProof needs a
Worldview-only capability, GIBS changes service semantics, or direct source
reuse is proposed. Until a separate accepted decision exists, the answer to
forking, embedding, or vendoring Worldview remains no.
