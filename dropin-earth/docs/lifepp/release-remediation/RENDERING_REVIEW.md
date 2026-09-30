# Request rendering, language and Worker review

This is a source review plus a regression-test specification. Actual candidate pass/fail must come from the matching CI command receipts and browser artifacts; this document does not turn a prior build into current acceptance.

## Concrete correction

The existing middleware skipped requests carrying client-controlled `purpose: prefetch` or `next-router-prefetch` headers. Against the prior Next build, a GET to `/life` with that header and `x-life-locale: en` returned English document language and no CSP. The same request against the prior OpenNext Worker remained Chinese with CSP. `prefetch-regression-before.json` records this reproduction and its missing exact timestamp/artifact binding explicitly.

The matcher now runs on claimed prefetches too. It always replaces the language, nonce and request CSP before the root layout reads headers. The static ecology homepage and existing asset/metadata exclusions remain. No frame origin or script permission is widened.

An additional real Next 15.5.26 probe at 2026-09-30T03:27:51Z found that `next-router-prefetch: 1` without `RSC: 1` entered a framework path returning HTTP 500 (`ReferenceError: location is not defined`). Deleting or checking that header inside middleware did not work. Inspection of the installed `next/dist/server/web/adapter.js` showed that Next hides Flight headers before middleware and restores them afterward.

A fixed `beforeFiles` rewrite in `next.config.mjs` validates the restored original flags and routes malformed combinations to `/request-errors/prefetch`, a local HTTP 400 JSON handler with private/no-store and noindex. It is not a business page, proxy or external redirect. Valid RSC prefetches and normal/purpose-prefetch HTML retain normal rendering. The `rsc` match is explicitly `^1$`: the installed OpenNext matcher does not automatically anchor header patterns, unlike Next's matcher. Both runtimes must reject missing, `2`, `11` and repeated `1, 1` RSC values in the browser suite, while preserving exact `1`. The failed middleware-only iterations remain diagnostic evidence; they are not counted as fixes.


## Retained rendering contract

- `/` remains `force-static`, with English document language and its ecological anchors, sample/demo copy and original entrances. Static homepage and metadata promotion remain the existing OpenNext path.
- The static homepage does not participate in middleware's per-request nonce policy; the nonce/cache assertions below apply to matched dynamic routes. No site-wide nonce coverage or new static-homepage CSP is claimed.
- Matched pages use the request-aware root layout. This opts inheriting pages into request rendering and binds framework scripts to the freshly generated nonce. It entails request rendering cost; it is not a claim of free CDN-cached HTML.
- Language is derived from the pathname, not Accept-Language, a cookie, or a caller-provided locale header. Chinese and English have distinct paths. No user-specific data is cached into a public response.
- Dynamic HTML and RSC must return private/no-store behavior as applicable. The test requires a unique nonce for every bounded HTML request and agreement between response CSP and executable bootstrap tags.
- Preview metadata/headers remain noindex; robots disallow and the sitemap has no public entries. Explicit production-mode build inputs are still necessary for production indexing.
- The `/api/*` production routing boundary belongs to the separate API Worker. Optional web consultation handlers therefore live at `/life/inquiries`, with no-store responses and default draft mode, rather than competing with the existing API or feedback route.
- Scene frame policy remains `frame-src 'none'`. No scene readiness or real GPU acceptance is inferred from these application tests.

## Required executable checks

`tests/browser/lifepp.spec.ts` now checks normal and forged-prefetch HTML on `/life`, `/en/life`, `/company`, `/en/company` and `/explorer`, including path-owned language, unique nonce, bootstrap binding, no-store/private cache control and preview indexing. RSC requests are checked separately. The static homepage is tested with a forged locale, and the JPG asset response remains a real image. Existing language transitions, ecology anchors, all 20 new locale routes, 404s, disabled scenes, keyboard draft flow and desktop/tablet/mobile checks remain.

The same suite must run against both the rebuilt Next server and the rebuilt local OpenNext Worker. All requested Chinese/English pages are now captured at each viewport; a capture alone is not a manual visual review. The final visual review record must identify the actual screenshots viewed.

## Primary documentation

[Next.js 15 CSP guidance](https://nextjs.org/docs/15/app/guides/content-security-policy) documents the request-rendering requirement and nonce/cache tradeoffs. Its optional prefetch exclusion is inappropriate here because this application's middleware also establishes the trusted language header. The decision is based on the reproduced application behavior, not on a blanket claim that the framework's example is insecure.
