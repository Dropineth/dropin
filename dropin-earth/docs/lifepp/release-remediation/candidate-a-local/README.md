# Candidate A local evidence

Actual build/test HEAD: `b4e3954d89c61484ea90435129229230a03e3abf`.
UTC run: 2026-09-30 03:42:47 through 03:45:02.
Node 22.22.3 / npm 10.9.4, macOS arm64. Application/config/workflow source was clean and unchanged throughout the run; see `run.json` for the 656-file source fingerprint and lock hash.

This archive copies the newly generated `reports/lifepp-validation/local-b4e3954` output without replacing older evidence. Original `.log` files are archived as `.txt` with unchanged bytes; the matching command JSON and run record retain their SHA-256. Four commands passed: OpenNext build, artifact shape, 15 workerd route checks and the workerd browser suite (72 Life++ checks plus 2 MapLibre synthetic rendering/fallback scenarios). This is not the complete remote Trust Gate.

`browser-workerd` contains the 63 page captures (20 routes at desktop/tablet/mobile, plus original ecology at all three sizes), 4 synthetic map captures and their JSON reports. Scene viewer fixtures, NASA raster/overlay fixtures and software GPU rendering are not real scene 31/29 readiness, data rights or hardware qualification. The configured consultation receiver was disabled; screenshots therefore show draft/not sent.

The English/Chinese visual review JSON files in the parent directory identify the actual images inspected and their hashes. Root interactive review covers the mobile scene/language/draft/clear/return journey. This is Codex visual inspection, not independent human release approval or physical-device testing. Original ecology mobile clipping is a reproduced pre-existing caveat, recorded separately.

A later documentation commit does not inherit this HEAD's green checks. The later commit must pass its own required CI. Its fresh workflow artifacts and PR-head checks are the authoritative record for that later HEAD.
