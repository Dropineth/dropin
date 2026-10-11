# Planetary reference UI integration — 2026-10-11

The user authorized a new visual homepage and read-only reference views in the
existing web application. This change retains the validated CanopyProof Logo,
the original ecology content, Explorer, Life++ Center, FourShopPlan and sample
boundaries. It does not install the supplied offline HTML as another site.

## Routes and behavior

| Surface | English | Chinese |
| --- | --- | --- |
| Home | `/` (`/en` redirects here) | `/zh` |
| Earth reference | `/earth` | `/zh/earth` |
| Evidence | `/evidence` | `/zh/evidence` |
| Participation status | `/participation` | `/zh/participation` |
| Trust | `/trust` | `/zh/trust` |

The original `CanopyProofLanding` remains unchanged at `/ecology`. The new root
retains the eight original anchor IDs and links to the original Methodology,
TerraProof, Open Stack and Proof Explorer. Existing Life routes are unchanged.

The globe uses Canvas2D software rendering, a local reference texture and typed
reference geography. It supports keyboard/buttons, drag, pause/resume and
reduced motion. Hidden/offscreen rendering pauses. Unmount releases animation,
listeners, observers and image handlers. Invalid texture data falls back to
vector geography; missing Canvas produces a labeled DOM reference. No WebGL,
Blender generation or actual project scene readiness is claimed.

The Earth selector presents reference geography or the supplied four-unit plan:
L112 58.69, L203 135.80, L202 185.99 and L201 290.78 square meters. These are not
surveyed boundaries or verified leases. Evidence panels use explicit synthetic
records, unknown fields and separate observation, estimation, verification,
issuance and retirement states. Procedural dots are not captured 3DGS data.
Participation contains status information only: no deposits, betting, custody,
draw engine, claims, payouts, payment forms or wallet integration were added.

English `/` remains force-static and uses the existing OpenNext asset promotion.
Other new routes use the existing request-bound CSP nonce and private/no-store
response path. Locale is derived from the URL; client locale/nonce headers are
overwritten. Canonical, hreflang, Open Graph Logo and localized Twitter metadata
are explicit. Preview remains noindex with an empty sitemap. Production sitemap
includes the language pairs. No CSP relaxation or deployment configuration
change is included.

## Source provenance

The supplied ZIP `CanopyProof_Planetary_UI_and_Draw_Security_20261011.zip` has
SHA-256 `b548fe5c7e72a49e5200f2dc949329e95b03b88b16d2350934c6135cddc9271c`.
Its 34 declared files were independently checked for byte size and SHA-256,
with archive path/CRC checks. The separately supplied `03_3DGS_GEO_CARBON_CN.md`
matches the package version. These are source-integrity checks, not validation
of physical measurements, rights, regulatory status or production readiness.

- `public/planetary/earth-texture.png` is an unchanged copy of `web/earth-texture.png`,
  SHA-256 `f515b6c9cb3670184e329185428775b51640a3d114eb91a7950e5b2373ce285a`.
- `components/planetary/referenceLand.ts` contains the supplied `web/land.mjs`
  coordinate data (283 rings, 7,325 longitude/latitude pairs), with TypeScript
  types. The package attributes this generalized geography to public-domain
  Natural Earth data; its build script shows simplification and rounding. It is
  labeled reference geography, not precise surveyed or licensed project data.
- Existing `/icon.jpg` remains the validated brand asset. No new remote asset,
  font CDN, recovered Three bundle, money primitives or source PDF is published.

## Validation and review limits

Local development used Node 22.22.3 and existing npm 10.9.8 dependencies. The
original remote workflows still pin Node 22.22.3 / npm 10.9.4 and perform a clean
install; local evidence does not replace those same-commit runs.

Before committing, all 957 unit tests, workspace typecheck, source-file ESLint,
supply-chain check, Next and OpenNext build passed. The first local browser run
passed all 150 existing checks; two added root-canonical checks initially
failed because Next normalizes the trailing slash. The new assertion now
compares the URL pathname. A source assertion was updated to verify the new
root component and continued presence of the original component at `/ecology`.
No old security or WebKit assertion, audit threshold or timeout was removed.

The existing Life browser suite adds 23 checks covering both languages, five
views, desktop/mobile, real Canvas pixels, both failure fallbacks, metadata and
original root anchors. The original ecology check now visits `/ecology` and
requires its original layout nodes. Request spoofing, prefetch, nonce/cache and
unknown-route cases also cover the new paths. All original three-engine and
workerd commands remain required. Exact final-head command results, screenshots
and failures belong in that candidate's CI artifacts and PR evidence, rather
than being copied from an earlier SHA.

Local Chromium lifecycle fixtures additionally measured reduced-motion pixel
stability, actual button rotation, texture failure and no-Canvas fallback;
unmount cleared RAF, eight tracked listeners, observers and image callbacks.
This is software browser evidence, not a physical GPU or real phone acceptance.

Visual review found a paused-globe blank frame after resize which the first
pixel-rotation assertion did not catch. The component now avoids resetting an
unchanged backing buffer and paints one static frame immediately on a real size
change, while leaving animation visibility-gated. A regression reproduced the
failure before the fix and passed with normal and corrupt texture inputs. The
browser suite also asserts painted pixels after full-page preparation/resize.

## Release boundary

Final-head CI, independent pre-merge human review, actual main CI, real rollback
identity, maintainer declaration, sealed production artifact review and the
existing production environment approval remain required in `RELEASE_REVIEW.md`.
An uploaded Cloudflare version is not an active production deployment.
Scenes 33/29, real consultation delivery, money operations and robot control are
not enabled by this integration. Their status must remain separate from UI and
website release acceptance.
