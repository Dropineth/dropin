# CanopyProof Cross-Browser WebGL

Status: PASS

Generated: 2026-08-11T11:35:06.367Z

Scenarios: 19; skipped: 0

| Engine | Profile | Scenario | Result |
| --- | --- | --- | --- |
| chromium | desktop-chromium | normal WebGL, InstancedMesh, pixels, controls, and privacy | PASS |
| chromium | desktop-chromium | missing WebGL API renders deterministic fallback | PASS |
| chromium | desktop-chromium | no WebGL renders deterministic usable fallback | PASS |
| chromium | desktop-chromium | dynamic Three.js chunk failure falls back | PASS |
| chromium | desktop-chromium | cold chunk deadline falls back without a late duplicate renderer | PASS |
| chromium | desktop-chromium | missed first-frame deadline renders deterministic fallback | PASS |
| chromium | desktop-chromium | context loss exposes controlled bounded recovery | PASS |
| chromium | desktop-chromium | reduced-motion policy remains readable and nonanimated | PASS |
| chromium | mobile-chromium | mobile WebGL has no viewport overflow and keeps controls operable | PASS |
| firefox | desktop-firefox | missing WebGL API renders deterministic fallback | PASS |
| firefox | desktop-firefox | no WebGL renders deterministic usable fallback | PASS |
| firefox | desktop-firefox | dynamic Three.js chunk failure falls back | PASS |
| firefox | desktop-firefox | reduced-motion policy remains readable and nonanimated | PASS |
| webkit | desktop-webkit | missing WebGL API renders deterministic fallback | PASS |
| webkit | desktop-webkit | no WebGL renders deterministic usable fallback | PASS |
| webkit | desktop-webkit | dynamic Three.js chunk failure falls back | PASS |
| webkit | desktop-webkit | cold chunk deadline falls back without a late duplicate renderer | PASS |
| webkit | desktop-webkit | reduced-motion policy remains readable and nonanimated | PASS |
| webkit | mobile-webkit | mobile WebKit fallback remains usable without viewport overflow | PASS |
