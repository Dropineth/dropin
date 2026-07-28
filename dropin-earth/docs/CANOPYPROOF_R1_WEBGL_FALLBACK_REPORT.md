# CanopyProof R1 WebGL Fallback Report

Status: PASS with documented platform limitation

Verification date: 2026-07-28

R1 implementation SHA:
`24eb9e4e29257bf36a76f47d64655831bb147ddd`

## Runtime Contract

The Global Impact Command Center now has an explicit lifecycle:

`SSR_PLACEHOLDER -> THREE_LOADING -> WEBGL_READY`

Bounded failures transition to `FALLBACK_STATIC`. A live context loss
transitions to `CONTEXT_LOST`. One operator-triggered recovery may enter
`RETRYING`; a second failure enters `TERMINAL_FALLBACK`.

The first rendered frame, not module resolution, marks readiness. Dynamic
import and first-frame timers are independently bounded, and late module
completion cannot mount a duplicate renderer.

The `/dashboard/global` page uses `dynamic = "force-dynamic"` under OpenNext's
single Cloudflare Worker Node.js compatibility runtime. It intentionally does
not declare Next Edge runtime. This permits middleware's per-request CSP nonce
to bind bootstrap scripts without violating the repository's supported
OpenNext runtime contract.

## Rendering And Privacy

- The scene uses exactly one `THREE.InstancedMesh` for all approved markers.
- `frameloop="demand"` prevents an uncontrolled animation loop.
- OrbitControls interaction requests redraws.
- Loading, WebGL, and static fallback states retain a fixed viewport footprint.
- The WebGL scene and static projection share the same generalized marker
  builder and dashboard root.
- Withheld regions never acquire geometry.
- Raw project, evidence, device, field, and bounding-box coordinates are absent
  from the fixture, DOM, and inspected request material.
- The fallback is deterministic HTML/CSS and makes no third-party map request.
- The fallback says it is a static snapshot and not a live operational claim.

## Browser Results

The production Next.js build was served locally and exercised with Playwright:

| Profile | Scenario | Result |
| --- | --- | --- |
| Desktop Chromium | nonblank WebGL pixels, one InstancedMesh, controls, privacy | PASS |
| Desktop Chromium | WebGL context creation returns null | PASS |
| Desktop Chromium | Three.js dynamic chunk fails | PASS |
| Desktop Chromium | cold chunk exceeds the 3.5 second deadline | PASS |
| Desktop Chromium | context loss and one bounded recovery | PASS |
| Desktop Chromium | reduced-motion static policy | PASS |
| Mobile Chromium | no overflow and controls operable | PASS |

The cold-network test waits beyond late module delivery and confirms that no
canvas or duplicate renderer appears after fallback. The normal path decodes
the canvas screenshot and requires multiple pixel colors, so a blank canvas
cannot pass.

Firefox and WebKit browser binaries are not installed in this environment.
Their fallback matrix was not run and is recorded as a platform limitation,
not a pass. Chromium desktop and mobile are the repository-required R1 gate.

## Safe Telemetry

Only the following local event counters/timing are emitted:

- `global_impact_webgl_ready_total`
- `global_impact_webgl_fallback_total`
- `global_impact_webgl_context_lost_total`
- `global_impact_webgl_retry_total`
- `global_impact_webgl_cold_start_ms`

Payloads contain exactly `metric`, `value`, `phase`, and `category`.
Coordinates, identifiers, device fingerprints, exception text, and stack
traces are prohibited. Timing is rounded to 25 milliseconds and capped at
30 seconds.

## OpenNext And Workerd

OpenNext Cloudflare 1.20.2 generated `.open-next/worker.js` and the assets
directory. Wrangler 4.114.0 served all nine required routes through local
workerd:

| Route | Status |
| --- | ---: |
| `/` | 200 |
| `/dashboard/global` | 200 |
| `/explorer` | 200 |
| `/governance` | 200 |
| `/terra` | 200 |
| `/mobile/report` | 200 |
| `/robots.txt` | 200 |
| `/sitemap.xml` | 200 |
| `/icon.jpg` | 200 |

Every response was nonempty, no HTML response exposed a runtime error, and
`/icon.jpg` retained its JPEG marker bytes.

Next.js continues to print its flat-config plugin-detection warning during
build. Independent strict lint and typecheck pass. No rule, CSP directive, or
runtime boundary was weakened to suppress the warning.
