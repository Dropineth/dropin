# Existing Dropin template build

This is the existing standalone Cloudflare `dropin` Worker, not the CanopyProof
website, API proxy, child backend, guardian service or recovery authority.

On 2026-11-12, authenticated platform reads identified the deployed `worker.js`
as the five-line `Hello world` handler preserved here. Its compatibility date is
2026-05-13, bindings are empty, workers.dev and version preview URLs are disabled,
and no CanopyProof domain route points to it. Existing deployment
`c5b3ae20-64c6-439d-83cb-8fd66247cdf3` serves version
`d8b123cb-a2cb-4097-981b-a76d54cc28a9` at 100%.

The independent Git triggers run at repository root with no build command and
`npx wrangler versions upload`. Build
`336e59de-f7c5-47b0-b5c9-1c6e63a0bd10`, commit
`ecbaee78deaa4dd9c43d0b33ef2e5f820f63a6e6`, failed with
`Missing entry-point to Worker script or to assets directory`.

The root Wrangler configuration repairs that missing entry point without
repurposing the Worker, adding resources, opening routes or changing its handler.
CanopyProof's separate triggers already use root `dropin-earth` and explicit
`apps/web/wrangler.jsonc`; they do not use this configuration.

The root configuration pins the already verified Cloudflare account. The
non-production trigger is separately pinned to
`npx --yes wrangler@4.148.0 versions upload --config wrangler.jsonc`, matching
the existing application lockfile instead of resolving an unpinned CLI. This
changes only candidate packaging, not live traffic. The main trigger is not
changed by this source patch.

Validate from repository root with the locked project Wrangler version:

```sh
dropin-earth/node_modules/.bin/wrangler versions upload --dry-run --config wrangler.jsonc
```

An actual `versions upload` creates a candidate only; it is not a traffic
deployment or proof that child accounts are operational. Keep existing traffic,
bindings, routes and disabled preview settings unchanged. Do not run
`wrangler deploy` or repoint this template at the child backend to make a check
green. No rollback is needed for an upload that leaves the active deployment
unchanged; verify the active version rather than assuming it stayed unchanged.
