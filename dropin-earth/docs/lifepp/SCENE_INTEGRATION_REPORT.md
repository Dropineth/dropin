# Life++ scene integration — bounded implementation report

Status: **viewer safety and fallback implemented; both real-source embeds disabled and unverified**.

## Actual source observations

`node scripts/lifepp-scene-check.mjs` ran on 2026-09-30, from 01:16:21.047Z to 01:16:23.899Z (UTC). Both HEAD requests returned `ECONNRESET`, message `socket hang up`:

| Scene | Original user-supplied source | Actual outcome |
| --- | --- | --- |
| 31 | `http://kjlying.com:8456/scenes/31` | `unverified_access_failed`; no HTTP status or response headers received |
| 29 | `http://kjlying.com:8456/scenes/29` | `unverified_access_failed`; no HTTP status or response headers received |

The complete returned observations are preserved in [scene-head-observations.json](evidence/scene-head-observations.json). Connection failure from this environment does not establish that either source is globally offline. No TLS certificate, HTTPS endpoint, internal page content, asset format, model, thumbnail or navigation behavior was verified. No alternative address was tried.

The checker sends HEAD only, accepts only the two exact original URLs, uses a 5-second deadline per request and 16 KiB header limit, and never reads response bodies. It handles redirects manually with a maximum of two, following only an exact supplied allowlist URL. Unknown hosts, credential URLs, queries, fragments, protocols and non-allowlisted redirects are rejected. A redirect advertising HTTPS is reported rather than guessed, substituted or followed outside that fixed list. The script does not log in, reuse credentials, disable TLS checks, read models or create a proxy.

## Delivered behavior

- `src/data/life/scenes.ts` validates the manifest at runtime and exposes immutable typed `scenes` and `getScene(id)`. Both original HTTP source strings remain unchanged. Unknown metadata stays `null`; unknown scene IDs have no registry entry.
- `SceneViewer({scene, locale})` supplies complete Chinese and English fallback copy, a clearly labeled generic placeholder, source-link copying and a deliberate external link with `noopener noreferrer` and `no-referrer`. Initial render creates no iframe or remote thumbnail request.
- `APPROVED_SCENE_EMBEDS` is empty. No environment variable or URL query can add an embed. The existing site CSP remains `frame-src 'none'`.
- The inactive future adapter path requires an exact canonical HTTPS URL, explicit scene permission/transport statuses, and a matching fixed approval record with references for display/embed permission, HTTPS/subresources, redirects, source frame policy, site frame policy and browser acceptance. Populating metadata alone cannot enable embedding.
- Once separately approved, loading requires a user action and consent. Mobile and absent-WebGL paths stay lightweight. The viewer has a 12-second readiness timeout, retry, full screen and exit/destroy. Removing the component removes its iframe document, readiness timer and message listener. A navigation after a ready signal invalidates readiness and tears down the frame.
- `iframe onLoad` never establishes readiness. The proposed adapter requests `lifepp:request-ready` and accepts only a `lifepp:scene-ready` response with exact origin, current frame window, protocol version `1`, scene ID and a fresh 128-bit session ID. Extra schema keys and stale sessions are rejected. Neither supplied source is known to implement this protocol.

## Actual validation and its limits

- `node --test --import tsx tests/unit/lifepp-scenes.test.ts`: **8 tests passed**, covering exact source identity/nulls, invalid registries, malicious URLs, missing approvals, strict message validation, lifecycle state transitions, timeout/unmount cleanup and rejected redirects.
- Scoped ESLint passed for the scene registry, React viewer, checker and both scene test files. `npm --workspace apps/web run typecheck` passed after the shared UI integration completed.
- `node --import tsx tests/browser/lifepp-scene-viewer.spec.ts`: **8 fixture scenarios passed** in installed Google Chrome **154.0.8037.58**. [viewer-fixture-report.json](evidence/viewer-fixture-report.json) preserves the returned report.

The browser test builds a temporary bundle whose approval list is replaced only in that bundle. Playwright fulfills all requests to the reserved `scene-adapter.example.test` fixture origin, and rejects other nonlocal requests. It exercises the actual React viewer, consent, handshake, full screen/exit, document-load non-readiness, malformed handshake, timeout/retry, unexpected navigation error, 375px fallback, no-WebGL fallback and component cleanup. There were no unexpected requests. GPU capability is mocked; these results are `fixture_only=true`, `actual_source_embedded=false`, and `gpu_rendering_tested=false`. They do not establish actual scene accessibility, authorization, rendering performance, real engine readiness or navigation acceptance. The CI workflow runs this isolated suite independently of actual-source fallback tests.

## Authorization and HTTPS gaps

Both source owners' display/embed rights remain pending. Download, retrieval, training, navigation, redistribution and commercial settlement permissions are independent and remain ungranted. HTTPS address, redirect/subresource safety, `frame-ancestors`/`X-Frame-Options`, an exact approved site `frame-src`, adapter protocol support and real browser acceptance remain outstanding. CORS is not an embedding permit. Visual 3DGS content does not establish metric accuracy, collision safety or ecological certification.

## Replaceable migration interface

An authorized source owner can later provide a confirmed HTTPS embed address or authorize an export for a separately designed self-hosted adapter. Preserve `sourceUrl`; record the new `embedUrl`, asset version, provenance and separately scoped permissions. Supply the required review references, implement and test a verifiable readiness mechanism, and review an exact CSP `frame-src` change before adding a fixed approval entry. Re-run real browser acceptance against the actual source and all redirects/subresources. A self-hosted implementation may replace the iframe adapter behind the same `SceneViewer`/registry interface, with its own resource disposal and rights checks. No export, self-hosting, model acquisition, arbitrary URL proxy or gateway was implemented in this release.

Implementation references: [MDN postMessage security guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns) and [MDN iframe behavior and sandbox guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).
